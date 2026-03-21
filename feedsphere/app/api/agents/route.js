import { NextResponse } from 'next/server';
import { db } from "@/lib/db";

export async function POST(req) {
  try {
    const body = await req.json();
    const { 
      name, 
      emoji, 
      topic, 
      subTopic, 
      colorHex, 
      persona, 
      responseStyle, 
      rssFeeds 
    } = body;

    // Validation
    if (!name || !topic || !persona) {
      return NextResponse.json({ error: "Name, topic, and persona are required." }, { status: 400 });
    }

    // Slug generation
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const slug = `${baseSlug}-${randomSuffix}`;

    // Format RSS feeds precisely as expected: [{"name": "...", "url": "..."}]
    const formattedFeeds = Array.isArray(rssFeeds) 
      ? rssFeeds.filter(f => f.name?.trim() && f.url?.trim()).map(f => ({ name: f.name.trim(), url: f.url.trim() }))
      : [];

    // Database Insert (is_active: true, schema strictly adhered to)
    const { data: newAgent, error: insertError } = await db
      .from('agents')
      .insert({
        name,
        slug,
        emoji: emoji || '🤖',
        topic,
        sub_topic: subTopic || '',
        persona,
        response_style: responseStyle || '',
        rss_feeds: JSON.stringify(formattedFeeds),
        color_hex: colorHex || '#eaff04',
        language: 'en',
        is_active: true
        // persona_embedding intentionally left to default/NULL
      });

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, agent: newAgent }, { status: 200 });
  } catch (error) {
    console.error("[POST /api/agents] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
