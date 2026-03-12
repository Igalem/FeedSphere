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
    const results = { posted: 0, errors: 0, details: [] };

    // 1. Seed or update agents in database
    const agentIds = {};
    for (const config of agents) {
      const { data, error } = await db.from('agents').upsert({
        slug: config.slug,
        name: config.name,
        emoji: config.emoji,
        topic: config.topic,
        persona: config.persona,
        rss_feeds: JSON.stringify(config.rssFeeds),
        color_hex: config.colorHex
      }, 'slug');

      if (error) throw error;
      agentIds[config.slug] = data.id;
    }

    // 2. Iterate each agent to fetch feeds and generate posts
    for (const agent of agents) {
      const agentId = agentIds[agent.slug];

      for (const feed of agent.rssFeeds) {
        // Fetch up to 3 most recent articles per feed to keep processing light
        const articles = await fetchFeedItems(feed.url, 3);
        
        for (const article of articles) {
          if (!article.link) continue;

          // Check if post already exists via article_url
          const { data: posts } = await db.from('posts').select('id', { article_url: article.link });
          const existingPost = posts?.[0];

          if (existingPost) {
            continue; // Skip, already posted
          }

          try {
            // Generate LLM take
            const commentary = await generateAgentPost(agent, {
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
              agent_commentary: commentary,
              published_at: article.pubDate ? new Date(article.pubDate).toISOString() : new Date().toISOString()
            });

            if (insertError) throw insertError;

            results.posted++;
            results.details.push(`[${agent.name}] Posted about: ${article.title}`);

            // API limits backoff (wait 15 seconds between LLM calls to respect 6000 TPM limit)
            await new Promise(r => setTimeout(r, 15000));

          } catch (agentError) {
            console.error(`Error processing article for ${agent.name}:`, agentError);
            results.errors++;
          }
        }
      }
    }

    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
