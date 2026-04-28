import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchFeedItems, scrapeMetadata } from '@/lib/rss';
import { generateAgentPost, generateAgentPerspective, resetLLMMaster, getRelevancyScore } from '@/lib/llm';
import { SETTINGS } from '@/lib/settings';
import { generateEmbedding, generateAgentEmbeddingText } from '@/lib/embeddings';


export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Helper for truly random shuffle (Fisher-Yates)
function shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export async function GET(request) {
  // Reset LLM master state for the new run
  resetLLMMaster();

  // Optional: Authenticate cron requests using CRON_SECRET
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (authHeader !== `Bearer ${SETTINGS.CRON_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = { posted: 0, skips: 0, errors: 0, details: [] };

    // 0. Static agent sync removed. Agents are now dynamic and created via UI.

    // 1. Fetch active agents prioritized by their LAST POST DATE (Hungry agents first)
    console.log('Fetching active agents with priority...');
    const { rows: allAgents } = await db.query(`
      SELECT a.*, MAX(p.published_at) as last_post_at
      FROM agents a
      LEFT JOIN posts p ON a.id = p.agent_id
      WHERE a.is_active = true
      GROUP BY a.id
      ORDER BY last_post_at ASC NULLS FIRST
    `);

    if (allAgents && allAgents.length > 0) {
      console.log(`[Cron] Found ${allAgents.length} active agents.`);
      console.log(`[Cron] HUNGRY LIST: ${allAgents.map(a => `${a.name} (${a.last_post_at || 'Never'})`).join(', ')}`);
      // SELF-HEALING: Auto-vectorize agents missing embeddings
      const missingVectors = allAgents.filter(a => !a.persona_embedding);
      if (missingVectors.length > 0) {
        console.log(`[Cron] Found ${missingVectors.length} agents missing embeddings. Auto-fixing...`);
        for (const agent of missingVectors) {
          try {
            const text = generateAgentEmbeddingText(agent);
            const vector = await generateEmbedding(text);
            const personaEmbedding = `[${vector.join(',')}]`;

            await db.query(`UPDATE agents SET persona_embedding = $1 WHERE id = $2`, [personaEmbedding, agent.id]);
            console.log(`[Cron] Successfully auto-vectorized agent: ${agent.name}`);

            // Update the local object so it can be used for matchmaking in this run
            agent.persona_embedding = personaEmbedding;
          } catch (e) {
            console.error(`[Cron] Failed to auto-vectorize agent ${agent.name}:`, e);
          }
        }
      }
    }

    if (!allAgents || allAgents.length === 0) {
      return NextResponse.json({ success: true, posted: 0, details: ['No agents found'] });
    }

    results.allActiveAgents = allAgents.map(a => a.name);

    // Process top 7 "hungry" agents per run (Decreased to control frequency)
    // We expand the pool to 10 agents to ensure some variety even if skipped
    const hungryPool = allAgents.slice(0, 10);
    const dbAgents = shuffle(hungryPool).slice(0, 7);

    console.log(`[Cron] PICKED AGENTS FOR THIS RUN (Prioritizing hungry): ${dbAgents.map(a => a.name).join(', ')}`);

    // 2. Pre-prepare agents and their feeds
    const agents = dbAgents.map(dbAgent => ({
      ...dbAgent,
      subTopic: dbAgent.sub_topic,
      colorHex: dbAgent.color_hex,
      responseStyle: dbAgent.response_style
    }));

    // Fetch feeds for all agents in parallel
    const agentsWithFeeds = await Promise.all(agents.map(async (agent) => {
      const { data: allTopicFeeds } = await db
        .from('rss_feeds')
        .select('*', { topic: agent.topic });

      const shuffledFeeds = shuffle(allTopicFeeds || []);
      const topicFeeds = shuffledFeeds.slice(0, 5);

      // DEBUG LOG for production
      console.log(`[Cron] Agent ${agent.name} (${agent.topic}) found ${allTopicFeeds?.length || 0} feeds.`);

      return { ...agent, rssFeeds: topicFeeds, allFeedsCount: allTopicFeeds?.length || 0, postCount: 0 };
    }));

    results.agentFeedStats = agentsWithFeeds.map(a => ({ name: a.name, topic: a.topic, feedCount: a.allFeedsCount }));

    // 3. Generation Loop
    for (const agent of agentsWithFeeds) {
      if (agent.postCount >= 1) continue;

      console.log(`[Cron] Processing Agent: ${agent.name} (Topic: ${agent.topic})`);

      // A. Try to find relevant articles from the DB POOL first (News Articles)
      // We use both Topic and Keyword matching (from the 10 sub-topics) for maximum recall
      const subTopicTerms = (agent.sub_topic || "").split(',').map(t => t.trim()).filter(t => t.length > 0);
      const keywordSql = subTopicTerms.length > 0
        ? `OR (${subTopicTerms.map((_, i) => `(title ILIKE $${i + 2} OR excerpt ILIKE $${i + 2})`).join(' OR ')})`
        : '';

      const { rows: dbArticles } = await db.query(`
        SELECT title, url, excerpt, image_url as "imageUrl", video_url as "videoUrl", source_name as "sourceName", published_at as "pubDate"
        FROM news_articles
        WHERE (LOWER(topic) = LOWER($1) ${keywordSql})
        AND published_at >= (CURRENT_TIMESTAMP - INTERVAL '${SETTINGS.MAX_ARTICLE_AGE_HOURS} hours')
        ORDER BY published_at DESC
        LIMIT 50
      `, [agent.topic, ...subTopicTerms.map(t => `%${t}%`)]);

      const candidates = dbArticles || [];
      console.log(`[Cron] Found ${candidates.length} candidate articles in DB for ${agent.name}`);

      const processArticle = async (article) => {
        if (agent.postCount >= 1) return;

        // --- DATE GATEKEEPER ---
        // Ensure we only post relatively fresh articles (last 30 hours)
        const pubDateStr = article.pubDate || article.isoDate;
        if (pubDateStr) {
          const articleTime = new Date(pubDateStr).getTime();
          const thirtyHoursAgo = Date.now() - (SETTINGS.MAX_ARTICLE_AGE_HOURS * 60 * 60 * 1000);
          if (articleTime < thirtyHoursAgo) {
            console.log(`[Gatekeeper] SKIPPING: Article "${article.title}" is too old (older than ${SETTINGS.MAX_ARTICLE_AGE_HOURS}h).`);
            return;
          }
        }

        // Check if already posted
        const { rows: existing } = await db.query('SELECT id FROM posts WHERE agent_id = $1 AND article_url = $2', [agent.id, article.url || article.link]);
        if (existing.length > 0) return;

        try {
          // --- RELEVANCY GATEKEEPER ---
          const { score, reasoning } = await getRelevancyScore(agent, article);
          console.log(`[Gatekeeper] ${agent.name} vs "${article.title}" -> Score: ${score} (${reasoning})`);

          if (score < 55) {
            console.log(`[Gatekeeper] SKIPPING: Article is not relevant to ${agent.name}'s niche (Score: ${score}).`);
            return;
          }

          // --- ENHANCE MEDIA (Deep Scrape if missing) ---
          if (!article.imageUrl || !article.videoUrl) {
            console.log(`[Scraper] Attempting to find media for: ${article.url || article.link}`);
            const extraMedia = await scrapeMetadata(article.url || article.link);
            if (extraMedia.imageUrl && !article.imageUrl) {
              article.imageUrl = extraMedia.imageUrl;
              console.log(`[Scraper] Found missing image: ${article.imageUrl}`);
            }
            if (extraMedia.videoUrl && !article.videoUrl) {
              article.videoUrl = extraMedia.videoUrl;
              console.log(`[Scraper] Found missing video: ${article.videoUrl}`);
            }
          }

          // --- GENERATION ---
          const isVideo = !!article.videoUrl;
          const isPerspectiveRun = !isVideo && article.imageUrl && Math.random() < SETTINGS.PERSPECTIVE_PROBABILITY;

          if (isVideo) {
            console.log(`[Video-Perspective] Generating for ${agent.name}...`);
            // Use regular post generator for shorter reaction as requested
            const llmOutput = await generateAgentPost(agent, {
              title: article.title,
              snippet: article.excerpt || article.snippet || '',
              sourceName: article.sourceName || 'News'
            });

            await db.from('posts').insert({
              agent_id: agent.id,
              article_title: article.title,
              article_url: article.url || article.link,
              article_image_url: article.imageUrl,
              video_url: article.videoUrl,
              article_excerpt: article.excerpt || article.snippet || '',
              source_name: article.sourceName || 'News',
              agent_commentary: llmOutput.agent_commentary,
              sentiment_score: llmOutput.sentiment_score,
              tags: llmOutput.tags,
              type: 'perspective',
              llm: llmOutput.llm,
              model: llmOutput.model,
              published_at: article.pubDate ? new Date(article.pubDate).toISOString() : new Date().toISOString()
            });

            results.details.push(`🎬 [${agent.name}] POSTED VIDEO PERSPECTIVE: ${article.title}`);
          } else if (isPerspectiveRun) {
            console.log(`[Perspective] Generating for ${agent.name}...`);
            const perspective = await generateAgentPerspective(agent, [article]);

            await db.from('posts').insert({
              agent_id: agent.id,
              article_title: article.title,
              article_url: article.url || article.link,
              article_image_url: article.imageUrl,
              video_url: article.videoUrl || null,
              article_excerpt: article.excerpt || article.snippet || '',
              source_name: article.sourceName || 'News',
              agent_commentary: perspective.agent_commentary,
              sentiment_score: perspective.sentiment_score,
              tags: perspective.tags,
              type: 'perspective',
              llm: perspective.llm,
              model: perspective.model,
              published_at: article.pubDate ? new Date(article.pubDate).toISOString() : new Date().toISOString()
            });

            results.details.push(`🌟 [${agent.name}] POSTED PERSPECTIVE: ${article.title}`);
          } else {
            const llmOutput = await generateAgentPost(agent, {
              title: article.title,
              snippet: article.excerpt || article.snippet || '',
              sourceName: article.sourceName || 'News'
            });

            await db.from('posts').insert({
              agent_id: agent.id,
              article_title: article.title,
              article_url: article.url || article.link,
              article_image_url: article.imageUrl || null,
              video_url: article.videoUrl || null,
              article_excerpt: article.excerpt || article.snippet || '',
              source_name: article.sourceName || 'News',
              agent_commentary: llmOutput.agent_commentary,
              sentiment_score: llmOutput.sentiment_score,
              tags: llmOutput.tags,
              type: 'reaction',
              llm: llmOutput.llm,
              model: llmOutput.model,
              published_at: article.pubDate ? new Date(article.pubDate).toISOString() : new Date().toISOString()
            });

            results.details.push(`✅ [${agent.name}] Posted: ${article.title}`);
          }

          results.posted++;
          agent.postCount++;

          await new Promise(r => setTimeout(r, 1500));
        } catch (err) {
          console.error(`[${agent.name}] Generation failed:`, err);
          results.errors++;
        }
      };

      // 1. Process DB articles
      for (const article of candidates) {
        if (agent.postCount >= 1) break;
        await processArticle(article);
      }

      // 2. Fallback to RSS if still needed (keeps coverage high if DB is empty or filters too strict)
      if (agent.postCount < 1) {
        console.log(`[Cron] Agent ${agent.name} still needs posts. Falling back to RSS feeds...`);
        for (const feed of agent.rssFeeds) {
          if (agent.postCount >= 1) break;
          try {
            const articles = await fetchFeedItems(feed.url, 5);
            for (const article of articles) {
              if (agent.postCount >= 1) break;
              await processArticle({ ...article, sourceName: feed.name });
            }
          } catch (e) {
            console.error(`[RSS Fallback] Failed for ${feed.name}:`, e.message);
          }
        }
      }
    }

    // 4. DEBATE TRIGGER (Global chance - Now runs twice for 0-2 debates)
    for (let i = 0; i < 2; i++) {
      if (Math.random() < SETTINGS.DEBATE_PROBABILITY) {
        console.log(`Triggering debate generation (Attempt ${i + 1})...`);
        try {
          const debateUrl = `${SETTINGS.API_BASE_URL}/api/debates/generate`;
          const authHeader = `Bearer ${SETTINGS.CRON_TOKEN}`;

          const debateRes = await fetch(debateUrl, {
            headers: { 'Authorization': authHeader }
          });

          if (debateRes.ok) {
            const debateData = await debateRes.json();
            results.details.push(`🔥 GLOBAL DEBATE CREATED: ${debateData.debate?.topic || 'Success'}`);
          } else {
            console.warn('Debate generation trigger failed:', await debateRes.text());
          }
        } catch (debErr) {
          console.error('Debate trigger error:', debErr);
        }
      }
    }

    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: error.message, success: false }, { status: 500 });
  }
}
