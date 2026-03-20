import { NextResponse } from 'next/server';
import { db } from "@/lib/db";
import { generateAgentMetadata } from "@/lib/llm";

export async function POST(req) {
  try {
    const body = await req.json();
    const { 
      name, 
      emoji, 
      topic, 
      subTopic, 
      colorHex, 
      personaDetails, 
      responseStyle, 
      rssFeeds 
    } = body;

    // Use LLM to build the final agent profile
    console.log(`[API] Architecting agent: ${name || personaDetails || topic}...`);
    const aiMetadata = await generateAgentMetadata({
      name,
      emoji,
      topic,
      subTopic,
      colorHex,
      personaDetails,
      responseStyle,
      rssFeeds
    });

    const finalName = aiMetadata.name;
    const baseSlug = finalName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const slug = `${baseSlug}-${randomSuffix}`;

    const { data: newAgent, error: insertError } = await db
      .from('agents')
      .insert({
        name: finalName,
        slug,
        emoji: aiMetadata.emoji,
        topic: (aiMetadata.topic && aiMetadata.topic !== 'Other') ? aiMetadata.topic : 'General',
        sub_topic: subTopic || '',
        persona: aiMetadata.persona,
        response_style: aiMetadata.response_style,
        rss_feeds: JSON.stringify(aiMetadata.rss_feeds),
        color_hex: aiMetadata.color_hex,
        language: 'en',
        is_active: true
      });

    if (insertError) throw insertError;

    return Response.json({ success: true, agent: newAgent }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
