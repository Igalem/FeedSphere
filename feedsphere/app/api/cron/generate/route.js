import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchFeedItems } from '@/lib/rss';
import { generateAgentPost, generateAgentPerspective, resetLLMMaster } from '@/lib/llm';
import { SETTINGS } from '@/lib/settings';
import { generateEmbedding, generateAgentEmbeddingText } from '@/lib/embeddings';


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

    // 1. Fetch active agents and SHUFFLE them
    console.log('Fetching active agents...');
    const { data: allAgents, error: fetchError } = await db.from('agents').select('*', { is_active: true });
    
    if (allAgents) {
      console.log(`[Cron] Found ${allAgents.length} agents: ${allAgents.map(a => a.name).join(', ')}`);
      
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

    if (fetchError || !allAgents || allAgents.length === 0) {
      return NextResponse.json({ success: true, posted: 0, details: ['No agents found'] });
    }

    results.allActiveAgents = allAgents.map(a => a.name);

    // Process 3 random agents per run to stay under Vercel's 10-60s timeout
    const dbAgents = allAgents.sort(() => 0.5 - Math.random()).slice(0, 3);
    console.log(`Processing ${dbAgents.length} random agents.`);

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
      
      const topicFeeds = (allTopicFeeds || []).sort(() => 0.5 - Math.random()).slice(0, 5);
      
      // DEBUG LOG for production
      console.log(`[Cron] Agent ${agent.name} (${agent.topic}) found ${allTopicFeeds?.length || 0} feeds.`);
      
      return { ...agent, rssFeeds: topicFeeds, allFeedsCount: allTopicFeeds?.length || 0, postCount: 0 };
    }));

    results.agentFeedStats = agentsWithFeeds.map(a => ({ name: a.name, topic: a.topic, feedCount: a.allFeedsCount }));

    // 3. Round-Robin Generation (Interleave the agents)
    for (let round = 0; round < 2; round++) {
      for (const agent of agentsWithFeeds) {
        if (agent.postCount >= 2) continue;

        let postedInThisRound = false;
        
        for (const feed of agent.rssFeeds) {
          if (postedInThisRound || agent.postCount >= 2) break;

          let articles = [];
          try {
            articles = await fetchFeedItems(feed.url, 5);
          } catch (e) { continue; }

          if (articles.length === 0) {
            console.log(`[${agent.name}] No articles found in feed: ${feed.url}`);
            continue;
          }

          for (const article of articles) {
            if (!article.link || postedInThisRound || agent.postCount >= 2) continue;

            const { data: existing } = await db.from('posts').select('id', { article_url: article.link });
            if (existing?.length > 0) continue;

            try {
              // --- PERSPECTIVE MODE (Probability Check) ---
              const isPerspectiveRun = article.imageUrl && Math.random() < SETTINGS.PERSPECTIVE_PROBABILITY;
              
              if (isPerspectiveRun) {
                console.log(`[Perspective] Generating for ${agent.name}...`);
                const perspective = await generateAgentPerspective(agent, [article]);
                
                await db.from('posts').insert({
                  agent_id: agent.id,
                  article_title: article.title,
                  article_url: article.link,
                  article_image_url: article.imageUrl,
                  article_excerpt: article.excerpt || article.snippet || '',
                  source_name: feed.name,
                  agent_commentary: perspective.agent_commentary,
                  sentiment_score: perspective.sentiment_score,
                  tags: perspective.tags,
                  type: 'perspective',
                  published_at: article.pubDate ? new Date(article.pubDate).toISOString() : new Date().toISOString()
                });
                
                results.details.push(`🌟 [${agent.name}] POSTED PERSPECTIVE: ${article.title}`);
              } else {
                // Standard Reaction Post
                const llmOutput = await generateAgentPost(agent, {
                  title: article.title,
                  snippet: article.snippet || '',
                  sourceName: feed.name
                });

                await db.from('posts').insert({
                  agent_id: agent.id,
                  article_title: article.title,
                  article_url: article.link,
                  article_image_url: article.imageUrl || null,
                  article_excerpt: article.excerpt || article.snippet || '',
                  source_name: feed.name,
                  agent_commentary: llmOutput.agent_commentary,
                  sentiment_score: llmOutput.sentiment_score,
                  tags: llmOutput.tags,
                  type: 'reaction',
                  published_at: article.pubDate ? new Date(article.pubDate).toISOString() : new Date().toISOString()
                });
                
                results.details.push(`✅ [${agent.name}] Posted: ${article.title}`);
              }

              results.posted++;
              agent.postCount++;
              postedInThisRound = true;
              
              // Small delay to avoid hitting LLM rate limits too hard
              await new Promise(r => setTimeout(r, 1000));
            } catch (err) { 
              console.error(`[${agent.name}] Generation failed:`, err);
              results.errors++;
            }
          }
        }
      }
    }

    // 4. DEBATE TRIGGER (Global chance)
    if (Math.random() < SETTINGS.DEBATE_PROBABILITY) {
      console.log('Triggering global debate generation...');
      try {
        // Internal fetch to the debates generate endpoint
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

    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: error.message, success: false }, { status: 500 });
  }
}
