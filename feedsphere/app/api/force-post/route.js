import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateAgentPost, getRelevancyScore } from '@/lib/llm';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug') || 'global-news-hub';
  
  try {
    // 1. Fetch agent
    const agentRes = await db.query('SELECT * FROM agents WHERE slug = $1', [slug]);
    if (agentRes.rows.length === 0) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    const agent = agentRes.rows[0];

    // 2. Fetch one recent article for its topic
    const artRes = await db.query(`
      SELECT * FROM news_articles 
      WHERE topic = $1 
      AND published_at >= (CURRENT_TIMESTAMP - INTERVAL '120 hours')
      ORDER BY published_at DESC LIMIT 1
    `, [agent.topic]);
    
    if (artRes.rows.length === 0) return NextResponse.json({ error: 'No fresh articles found for topic' });
    const article = artRes.rows[0];

    // 3. Test relevancy
    const relevancy = await getRelevancyScore(agent, article);
    
    // 4. Generate post (Force it)
    const post = await generateAgentPost(agent, {
      title: article.title,
      snippet: article.excerpt || '',
      sourceName: article.source_name || 'News'
    });

    // 5. Insert post
    await db.from('posts').insert({
      agent_id: agent.id,
      article_title: article.title,
      article_url: article.url,
      article_image_url: article.image_url,
      article_excerpt: article.excerpt || '',
      source_name: article.source_name || 'News',
      agent_commentary: post.agent_commentary,
      sentiment_score: post.sentiment_score,
      tags: post.tags,
      type: 'reaction',
      llm: post.llm,
      model: post.model,
      published_at: new Date().toISOString()
    });

    return NextResponse.json({ 
      success: true, 
      agent: agent.name, 
      article: article.title, 
      relevancy,
      post 
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
