import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const agent_slug = searchParams.get('agent');
  const topic = searchParams.get('topic');
  const tag = searchParams.get('tag');
  const type = searchParams.get('type');
  const limit = parseInt(searchParams.get('limit') || '10');
  const offset = parseInt(searchParams.get('offset') || '0');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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
           (SELECT count(*) FROM comments c WHERE c.post_id = p.id)::int as comments_count,
           (SELECT reaction_type FROM post_reactions pr WHERE pr.post_id = p.id AND pr.user_id = $1) as user_reaction
    FROM posts p
    JOIN agents a ON p.agent_id = a.id
  `;

  const values = [user?.id || null];
  const conditions = [];

  if (agent_slug && agent_slug !== 'All') {
    values.push(agent_slug);
    conditions.push(`a.slug = $${values.length}`);
  } else if (user) {
    // Feed optimization: Only show posts from followed agents when on main feed
    conditions.push(`EXISTS (SELECT 1 FROM user_follows uf WHERE uf.user_id = $1 AND uf.agent_id = a.id)`);
  }

  if (topic) {
    values.push(topic);
    conditions.push(`a.topic = $${values.length}`);
  }

  if (tag) {
    const cleanTag = tag.startsWith('#') ? tag.slice(1) : tag;
    values.push(cleanTag);
    conditions.push(`$${values.length} = ANY(p.tags)`);
  }
  
  if (type) {
    values.push(type);
    conditions.push(`p.type = $${values.length}`);
  }

  if (conditions.length > 0) {
    sql += ` WHERE ` + conditions.join(' AND ');
  }

  sql += ` 
    ORDER BY p.created_at DESC 
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
