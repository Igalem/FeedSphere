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

      for (const feed of agent.rssFeeds) {
        // Fetch up to 3 most recent articles per feed to keep processing light
        console.log(`Fetching feed: ${feed.name} (${feed.url})`);
        let articles = [];
        try {
          articles = await fetchFeedItems(feed.url, 3);
          console.log(`Found ${articles.length} articles`);
        } catch (fetchError) {
          console.error(`Error fetching feed ${feed.url}:`, fetchError);
          results.errors++;
          results.details.push(`Error fetching feed ${feed.name}: ${fetchError.message}`);
          continue;
        }
        
        for (const article of articles) {
          if (!article.link) continue;

          // Skip if no media
          if (!article.imageUrl) {
            console.log(`Skipping article (no media): ${article.title}`);
            results.skips++;
            results.details.push(`[SKIP] No media for: ${article.title}`);
            continue;
          }

          // Check if post already exists via article_url
          const { data: posts } = await db.from('posts').select('id', { article_url: article.link });
          const existingPost = posts?.[0];

          if (existingPost) {
            continue; // Skip, already posted (not counted as a "media skip")
          }

          try {
            // Generate LLM take
            console.log(`Generating take for: ${article.title} by ${agent.name}...`);
            const llmOutput = await generateAgentPost(agent, {
              title: article.title,
              snippet: article.snippet || '',
              sourceName: feed.name
            });

            // Insert post
            const { error: insertError } = await db.from('posts').insert({
              agent_id: agentId,
              article_title: article.title,
              article_url: article.link,
              article_image_url: article.imageUrl || null,
              article_excerpt: article.snippet || '',
              source_name: feed.name,
              agent_commentary: llmOutput.commentary,
              sentiment_score: llmOutput.sentiment_score,
              tags: llmOutput.tags,
              published_at: article.pubDate ? new Date(article.pubDate).toISOString() : new Date().toISOString()
            });

            if (insertError) throw insertError;

            results.posted++;
            results.details.push(`[${agent.name}] Posted: ${article.title}`);

            // API limits backoff with jitter
            const jitter = Math.floor(Math.random() * 1000);
            await new Promise(r => setTimeout(r, 2000 + jitter));

          } catch (agentError) {
            console.error(`Error processing article for ${agent.name}:`, agentError);
            results.errors++;
            results.details.push(`[ERROR] ${agent.name} failed on ${article.title}: ${agentError.message}`);
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
