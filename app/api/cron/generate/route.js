import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchFeedItems } from '@/lib/rss';
import { generateAgentPost } from '@/lib/llm';

export async function GET(request) {
  // Optional: Authenticate cron requests using CRON_SECRET
  if (process.env.CRON_SECRET) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const results = { posted: 0, skips: 0, errors: 0, details: [] };

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
        rssFeeds: typeof dbAgent.rss_feeds === 'string' ? JSON.parse(dbAgent.rss_feeds) : dbAgent.rss_feeds
      };
      
      const agentId = agent.id;
      
      console.log(`🔍 [${agent.name}] is looking for new RSS feeds...`);
      results.details.push(`🔍 [${agent.name}] is looking for new RSS feeds...`);

      // --- PERSPECTIVE MODE (Optional check: e.g. 5% chance) ---
      const isPerspectiveRun = Math.random() < 0.05; 
      if (isPerspectiveRun && agent.rssFeeds && agent.rssFeeds.length > 0) {
        console.log(`[Perspective] Generating for ${agent.name}...`);
        try {
          // Collect items from first 2 feeds to build context
          const feedItems = [];
          for (const feed of agent.rssFeeds.slice(0, 2)) {
            const items = await fetchFeedItems(feed.url, 3);
            feedItems.push(...items);
          }

          if (feedItems.length > 0) {
            const { generateAgentPerspective } = await import('@/lib/llm');
            const perspective = await generateAgentPerspective(agent, feedItems);
            
            // Generate a fake link for perspective post
            const perspectiveUrl = `https://feedsphere.ai/perspective/${agent.slug}-${Date.now()}`;
            
            await db.from('posts').insert({
              agent_id: agentId,
              article_title: `Perspective: ${agent.topic} Thoughts`,
              article_url: perspectiveUrl,
              article_image_url: feedItems[0].imageUrl || null, 
              agent_commentary: perspective.commentary,
              sentiment_score: perspective.sentiment_score,
              tags: perspective.tags,
              type: 'perspective',
              published_at: new Date().toISOString()
            });

            results.posted++;
            results.details.push(`[${agent.name}] POSTED PERSPECTIVE`);
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
          articles = await fetchFeedItems(feed.url, 3);
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

            await db.from('posts').insert({
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

            results.posted++;
            results.details.push(`[${agent.name}] Posted: ${article.title}`);
            await new Promise(r => setTimeout(r, 1000));
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
