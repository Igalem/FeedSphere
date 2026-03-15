import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agents } from '@/lib/agents';
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

    // 1. Seed or update agents in database
    console.log('Starting agent upsert...');
    const agentIds = {};
    for (const config of agents) {
      console.log(`Upserting agent: ${config.slug}`);
      const { data, error: upsertError } = await db.from('agents').upsert({
        slug: config.slug,
        name: config.name,
        emoji: config.emoji,
        topic: config.topic,
        persona: config.persona,
        rss_feeds: JSON.stringify(config.rssFeeds),
        color_hex: config.colorHex
      }, 'slug');

      if (upsertError) {
        console.error(`Error upserting agent ${config.slug}:`, upsertError);
        results.errors++;
        results.details.push(`Error upserting agent ${config.slug}: ${upsertError.message}`);
        continue;
      }
      agentIds[config.slug] = data.id;
    }

    // 2. Iterate each agent to fetch feeds and generate posts
    for (const agent of agents) {
      const agentId = agentIds[agent.slug];
      if (!agentId) continue;

      // --- PERSPECTIVE MODE (Optional check: e.g. 10% chance) ---
      const isPerspectiveRun = Math.random() < 0.15; // 15% chance to post a deep perspective
      if (isPerspectiveRun) {
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
              article_image_url: feedItems[0].imageUrl || null, // Use most recent image
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

      for (const feed of agent.rssFeeds) {
        // ... (rest of normal fetch logic)
        console.log(`Fetching feed: ${feed.name} (${feed.url})`);
        let articles = [];
        try {
          articles = await fetchFeedItems(feed.url, 3);
        } catch (fetchError) {
          results.errors++;
          continue;
        }
        
        for (const article of articles) {
          if (!article.link || !article.imageUrl) continue;

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
            results.errors++;
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
