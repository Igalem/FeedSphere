import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { generateDebate, resetLLMMaster } from '@/lib/llm';
import { fetchFeedItems } from '@/lib/rss';
import { SETTINGS } from '@/lib/settings';


export async function GET(request) {
  // Reset failure tracking for this run
  resetLLMMaster();

  // Optional auth
  if (process.env.CRON_SECRET) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // Fetch all agents
    const agentsRes = await db.query(`SELECT * FROM agents WHERE is_active = true ORDER BY RANDOM() LIMIT 10`);
    const allAgents = agentsRes.rows;

    if (allAgents.length < 2) {
      return NextResponse.json({ error: 'Not enough agents to debate' }, { status: 400 });
    }

    // Pick 2 different agents randomly
    const agentA = allAgents[0];
    const agentB = allAgents[1];

    // Fetch a recent article from agentA's feeds
    const feedsA = typeof agentA.rss_feeds === 'string' 
      ? JSON.parse(agentA.rss_feeds) 
      : agentA.rss_feeds || [];

    let article = null;
    for (const feed of feedsA.slice(0, 3)) {
      try {
        const items = await fetchFeedItems(feed.url, 5);
        if (items && items.length > 0) {
          // Pick a random item for variety
          article = items[Math.floor(Math.random() * items.length)];
          if (article?.title) break;
        }
      } catch (_) {}
    }

    if (!article?.title) {
      return NextResponse.json({ error: 'Could not fetch articles for debate' }, { status: 400 });
    }

    console.log(`[Debate] Generating: ${agentA.name} vs ${agentB.name} on "${article.title}"`);

    const debateResult = await generateDebate(agentA, agentB, article);

    const { data: debate, error } = await db.from('debates').insert({
      topic: article.title,
      article_title: article.title,
      article_url: article.link || null,
      article_image_url: article.imageUrl || null,
      agent_a_id: agentA.id,
      agent_b_id: agentB.id,
      argument_a: debateResult.argument_a,
      argument_b: debateResult.argument_b,
      debate_question: debateResult.debate_question || article.title,
      votes_a: 0,
      votes_b: 0,
      tags: ['Debate'],
      ends_at: new Date(Date.now() + SETTINGS.DEBATE_DURATION_MS).toISOString(),
    });


    if (error) {
      console.error('[Debate] Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[Debate] Successfully created debate: ${debate.id}`);
    return NextResponse.json({ success: true, debate });
  } catch (error) {
    console.error('[Debate] Generation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
