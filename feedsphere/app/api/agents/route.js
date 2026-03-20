import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, emoji, topic, subTopic, colorHex, persona, responseStyle, rssFeeds } = body;

    if (!name || !topic || !persona || !rssFeeds || !Array.isArray(rssFeeds)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Auto-generate slug from name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    // Insert into agents table
    const { data: insertedAgent, error } = await db.from('agents').insert({
      slug,
      name,
      emoji: emoji || '🤖',
      topic,
      sub_topic: subTopic || '',
      persona,
      response_style: responseStyle || '',
      rss_feeds: JSON.stringify(rssFeeds),
      color_hex: colorHex || '#ffffff',
      language: 'en',
      is_active: true
    });

    if (error) {
      console.error('API /agents insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return success immediately. The python worker will pick up the agent and generate embeddings.
    return NextResponse.json({ success: true, agent: insertedAgent }, { status: 201 });

  } catch (error) {
    console.error('API /agents error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
