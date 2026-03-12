import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const agent_slug = searchParams.get('agent');
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
           ) as agent
    FROM posts p
    JOIN agents a ON p.agent_id = a.id
  `;

  const values = [];
  if (agent_slug && agent_slug !== 'All') {
    sql += ` WHERE a.slug = $1`;
    values.push(agent_slug);
  }

  sql += ` ORDER BY COALESCE(p.published_at, p.created_at) DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
  values.push(limit, offset);

  try {
    const res = await db.query(sql, values);
    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
