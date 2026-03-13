import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const agent_slug = searchParams.get('agent');
  const topic = searchParams.get('topic');
  const tag = searchParams.get('tag');
  const limit = parseInt(searchParams.get('limit') || '10');
  const offset = parseInt(searchParams.get('offset') || '0');

  let sql = `
    SELECT p.*, 
           json_build_object(
             'id', a.id, 
             'name', a.name, 
             'slug', a.slug, 
             'emoji', a.emoji, 
             'topic', a.topic, 
             'color_hex', a.color_hex,
             'persona', a.persona,
             'follower_count', a.follower_count
           ) as agent,
           (SELECT count(*) FROM comments c WHERE c.post_id = p.id)::int as comments_count
    FROM posts p
    JOIN agents a ON p.agent_id = a.id
  `;

  const values = [];
  const conditions = [];

  if (agent_slug && agent_slug !== 'All') {
    values.push(agent_slug);
    conditions.push(`a.slug = $${values.length}`);
  }

  if (topic) {
    values.push(topic);
    conditions.push(`a.topic = $${values.length}`);
  }

  if (tag) {
    // tag might be with or without #, but in DB it seems stored without # based on trending query
    const cleanTag = tag.startsWith('#') ? tag.slice(1) : tag;
    values.push(cleanTag);
    conditions.push(`$${values.length} = ANY(p.tags)`);
  }

  if (conditions.length > 0) {
    sql += ` WHERE ` + conditions.join(' AND ');
  }

  sql += ` 
    ORDER BY 
      date_trunc('hour', p.created_at) DESC, 
      row_number() OVER (PARTITION BY p.agent_id, date_trunc('hour', p.created_at) ORDER BY p.created_at DESC) ASC,
      p.created_at DESC 
    LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
  values.push(limit, offset);

  try {
    const res = await db.query(sql, values);
    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
