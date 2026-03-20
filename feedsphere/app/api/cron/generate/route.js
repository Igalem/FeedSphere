import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchFeedItems } from '@/lib/rss';
import { generateAgentPost, resetLLMMaster } from '@/lib/llm';
import { SETTINGS } from '@/lib/settings';


export async function GET(request) {
  // Reset LLM master state for the new run
  resetLLMMaster();

  // Optional: Authenticate cron requests using CRON_SECRET
  if (process.env.CRON_SECRET) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const results = { posted: 0, skips: 0, errors: 0, details: [] };

    // 0. Static agent sync removed. Agents are now dynamic and created via UI.

    // 1. Fetch active agents from database
    console.log('Fetching active agents from database...');
    const { data: dbAgents, error: fetchError } = await db.from('agents').select('*', { is_active: true });

    if (fetchError) {
      console.error('Error fetching agents:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch agents', details: fetchError.message }, { status: 500 });
    }

    if (!dbAgents || dbAgents.length === 0) {
      console.log('No active agents found.');
      return NextResponse.json({ success: true, posted: 0, details: ['No active agents found'] });
    }

    console.log(`Processing ${dbAgents.length} active agents.`);

    // 2. Iterate each agent to fetch feeds and generate posts
    for (const dbAgent of dbAgents) {
      // Normalize agent object for the rest of the logic
      const agent = {
        ...dbAgent,
        rssFeeds: typeof dbAgent.rss_feeds === 'string' ? JSON.parse(dbAgent.rss_feeds) : dbAgent.rss_feeds,
        subTopic: dbAgent.sub_topic,
        colorHex: dbAgent.color_hex,
        responseStyle: dbAgent.response_style
      };
      
      const agentId = agent.id;
      
      console.log(`🔍 [${agent.name}] is looking for new RSS feeds...`);
      results.details.push(`🔍 [${agent.name}] is looking for new RSS feeds...`);

      // --- PERSPECTIVE MODE (Optional check: e.g. 5% chance) ---
      const isPerspectiveRun = Math.random() < SETTINGS.PERSPECTIVE_PROBABILITY; 
      if (isPerspectiveRun && agent.rssFeeds && agent.rssFeeds.length > 0) {
        console.log(`[Perspective] Generating for ${agent.name}...`);
        try {
          // Collect items from first 2 feeds to build context
          const feedItems = [];
          for (const feed of agent.rssFeeds.slice(0, 2)) {
            const items = await fetchFeedItems(feed.url, SETTINGS.MAX_FEED_ITEMS_PER_FETCH);
            // Attach source name to each item
            const itemsWithSource = items.map(item => ({ ...item, sourceName: feed.name }));
            feedItems.push(...itemsWithSource);
          }

          if (feedItems.length > 0) {
            const { generateAgentPerspective } = await import('@/lib/llm');
            
            // Find a primary article that has an image AND does not already exist in the database
            let primaryArticle = null;
            const candidates = feedItems.filter(item => item.imageUrl);
            
            for (const cand of candidates) {
              const { data: existing } = await db.from('posts').select('id', { article_url: cand.link });
              if (!existing || existing.length === 0) {
                primaryArticle = cand;
                break;
              }
            }
            
            if (!primaryArticle) {
              console.log(`[Perspective] Skipped for ${agent.name} - No new articles with images available.`);
              continue; 
            }
            
            const perspective = await generateAgentPerspective(agent, [primaryArticle, ...feedItems.filter(i => i !== primaryArticle)]);
            
            const { data: insertedPost, error: insertError } = await db.from('posts').insert({
              agent_id: agentId,
              article_title: primaryArticle.title,
              article_url: primaryArticle.link,
              article_image_url: primaryArticle.imageUrl, 
              source_name: primaryArticle.sourceName,
              agent_commentary: perspective.commentary,
              sentiment_score: perspective.sentiment_score,
              tags: perspective.tags,
              type: 'perspective',
              published_at: new Date().toISOString()
            });

            if (insertError) {
              console.error(`[Perspective] Insert failed for ${agent.name}:`, insertError);
              results.errors++;
              results.details.push(`❌ [${agent.name}] Perspective insert failed: ${insertError.message || 'Unknown error'}`);
            } else {
              results.posted++;
              results.details.push(`[${agent.name}] POSTED PERSPECTIVE`);
            }
            continue; // Skip normal posts for this agent this run
          }
        } catch (perError) {
          console.error(`Perspective failed for ${agent.name}:`, perError);
        }
      }

      if (!agent.rssFeeds || !Array.isArray(agent.rssFeeds)) {
        console.log(`Agent ${agent.name} has no valid RSS feeds.`);
        continue;
      }

      for (const feed of agent.rssFeeds) {
        console.log(`[${agent.name}] Fetching feed: ${feed.name} (${feed.url})`);
        let articles = [];
        try {
          articles = await fetchFeedItems(feed.url, SETTINGS.MAX_FEED_ITEMS_PER_FETCH);
        } catch (fetchError) {
          console.error(`[${agent.name}] Error fetching feed ${feed.url}:`, fetchError);
          results.errors++;
          results.details.push(`❌ [${agent.name}] Error fetching feed: ${feed.name}`);
          continue;
        }
        
        for (const article of articles) {
          if (!article.link || !article.imageUrl) continue;

          // Check if post already exists
          const { data: posts } = await db.from('posts').select('id', { article_url: article.link });
          if (posts?.length > 0) continue;

          try {
            const llmOutput = await generateAgentPost(agent, {
              title: article.title,
              snippet: article.snippet || '',
              sourceName: feed.name
            });

            const { error: insertError } = await db.from('posts').insert({
              agent_id: agentId,
              article_title: article.title,
              article_url: article.link,
              article_image_url: article.imageUrl,
              article_excerpt: article.snippet || '',
              source_name: feed.name,
              agent_commentary: llmOutput.commentary,
              sentiment_score: llmOutput.sentiment_score,
              tags: llmOutput.tags,
              type: 'reaction',
              published_at: article.pubDate ? new Date(article.pubDate).toISOString() : new Date().toISOString()
            });
            
            if (insertError) {
              console.error(`[${agent.name}] Insert failed for article:`, insertError);
              results.errors++;
              results.details.push(`❌ [${agent.name}] Error saving post: ${article.title}`);
            } else {
              results.posted++;
              results.details.push(`[${agent.name}] Posted: ${article.title}`);
            }
            await new Promise(r => setTimeout(r, SETTINGS.AGENT_DELAY_MS));
          } catch (agentError) {
            console.error(`[${agent.name}] failed to generate post:`, agentError);
            results.errors++;
            results.details.push(`❌ [${agent.name}] Error generating post for: ${article.title}`);
          }
        }
      }
    }

    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: error.message, success: false }, { status: 500 });
  }
}
