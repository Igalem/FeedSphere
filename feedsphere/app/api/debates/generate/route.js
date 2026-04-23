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
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${SETTINGS.CRON_TOKEN}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // Fetch all agents
    const agentsRes = await db.query(`SELECT * FROM agents WHERE is_active = true ORDER BY RANDOM() LIMIT 15`);
    const allAgents = agentsRes.rows;

    if (allAgents.length < 2) {
      return NextResponse.json({ error: 'Not enough agents to debate' }, { status: 400 });
    }

    let article = null;
    let agentA = null;
    let agentB = null;

    // Shuffle agents to try different "initiators"
    const shuffledAgents = [...allAgents].sort(() => Math.random() - 0.5);

    console.log(`[Debate] Attempting to find article from up to 8 of ${shuffledAgents.length} active agents...`);

    for (let i = 0; i < Math.min(shuffledAgents.length, 8); i++) {
      const candidateA = shuffledAgents[i];
      
      const feedsA = typeof candidateA.rss_feeds === 'string' 
        ? JSON.parse(candidateA.rss_feeds) 
        : candidateA.rss_feeds || [];

      if (feedsA.length === 0) {
        console.log(`[Debate] Agent ${candidateA.name} has no feeds, skipping.`);
        continue;
      }

      let foundForThisAgent = false;
      for (const feed of feedsA.slice(0, 3)) {
        try {
          console.log(`[Debate] Trying agent ${candidateA.name} feed: ${feed.url}`);
          const items = await fetchFeedItems(feed.url, 5);
          if (items && items.length > 0) {
            // Pick a random item for variety
            const validItems = items.filter(item => item && item.title);
            if (validItems.length > 0) {
              article = validItems[Math.floor(Math.random() * validItems.length)];
              agentA = candidateA;
              console.log(`[Debate] SUCCESS: Found article for ${candidateA.name}: "${article.title}"`);
              foundForThisAgent = true;
              break;
            }
          }
        } catch (e) {
          console.error(`[Debate] Feed error for ${candidateA.name} (${feed.url}):`, e.message);
        }
      }

      if (foundForThisAgent) break;
    }

    if (!article?.title || !agentA) {
      return NextResponse.json({ error: 'Could not fetch articles for debate from any agent' }, { status: 400 });
    }

    // Pick a different agent B as opponent
    const remainingAgents = allAgents.filter(a => a.id !== agentA.id);
    if (remainingAgents.length === 0) {
      return NextResponse.json({ error: 'No opponent found for debate' }, { status: 400 });
    }
    agentB = remainingAgents[Math.floor(Math.random() * remainingAgents.length)];

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
