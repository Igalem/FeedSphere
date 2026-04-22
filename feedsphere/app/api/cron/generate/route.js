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

    // 1. Fetch active agents and SHUFFLE them
    console.log('Fetching active agents...');
    const { data: allAgents, error: fetchError } = await db.from('agents').select('*', { is_active: true });

    if (fetchError || !allAgents || allAgents.length === 0) {
      return NextResponse.json({ success: true, posted: 0, details: ['No agents found'] });
    }

    // Process 3 random agents per run to stay under Vercel's 10-60s timeout
    const dbAgents = allAgents.sort(() => 0.5 - Math.random()).slice(0, 3);
    console.log(`Processing ${dbAgents.length} random agents.`);

    for (const dbAgent of dbAgents) {
      // Fetch and SHUFFLE feeds for this agent's topic
      const { data: allTopicFeeds } = await db
        .from('rss_feeds')
        .select('*', { topic: dbAgent.topic });

      // Limit to 5 random feeds per agent per run
      const topicFeeds = (allTopicFeeds || []).sort(() => 0.5 - Math.random()).slice(0, 5);

      const agent = {
        ...dbAgent,
        rssFeeds: topicFeeds,
        subTopic: dbAgent.sub_topic,
        colorHex: dbAgent.color_hex,
        responseStyle: dbAgent.response_style
      };
      
      console.log(`🔍 [${agent.name}] checking ${topicFeeds.length} feeds in ${agent.topic}...`);
      results.details.push(`🔍 [${agent.name}] checking ${topicFeeds.length} feeds...`);

      let agentPostCount = 0;

      for (const feed of agent.rssFeeds) {
        if (agentPostCount >= 2) break; // Max 2 posts per agent per run

        console.log(`[${agent.name}] Fetching: ${feed.name}`);
        let articles = [];
        try {
          articles = await fetchFeedItems(feed.url, 3);
        } catch (e) { continue; }
        
        for (const article of articles) {
          if (!article.link || !article.imageUrl || agentPostCount >= 2) continue;

          // Check if post already exists
          const { data: existing } = await db.from('posts').select('id', { article_url: article.link });
          if (existing?.length > 0) continue;

          try {
            const llmOutput = await generateAgentPost(agent, {
              title: article.title,
              snippet: article.snippet || '',
              sourceName: feed.name
            });

            const { error: insertError } = await db.from('posts').insert({
              agent_id: agent.id,
              article_title: article.title,
              article_url: article.link,
              article_image_url: article.imageUrl,
              article_excerpt: article.excerpt || article.snippet || '',
              source_name: feed.name,
              agent_commentary: llmOutput.agent_commentary,
              sentiment_score: llmOutput.sentiment_score,
              tags: llmOutput.tags,
              type: 'reaction',
              published_at: article.pubDate ? new Date(article.pubDate).toISOString() : new Date().toISOString()
            });
            
            if (insertError) {
              console.error(`Post failed for ${agent.name}:`, insertError);
              continue;
            }

            results.posted++;
            results.details.push(`✅ [${agent.name}] Posted: ${article.title}`);
            agentPostCount++;
          } catch (agentError) {
            console.error(`Post failed:`, agentError);
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
