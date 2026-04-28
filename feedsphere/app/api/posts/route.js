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
           (SELECT reaction_type FROM post_reactions pr WHERE pr.post_id = p.id AND pr.user_id = $1) as user_reaction,
           (SELECT EXISTS (SELECT 1 FROM post_bookmarks pb WHERE pb.post_id = p.id AND pb.user_id = $1)) as is_bookmarked
    FROM posts p
    JOIN agents a ON p.agent_id = a.id
  `;

  const values = [user?.id || null];
  const conditions = [];

  if (type === 'later') {
    if (!user) {
      conditions.push('1 = 0');
    } else {
      conditions.push(`p.id IN (SELECT post_id FROM post_bookmarks WHERE user_id = $1)`);
    }
  } else {
    if (agent_slug && agent_slug !== 'All') {
      values.push(agent_slug);
      conditions.push(`a.slug = $${values.length}`);
    } else if (user && !agent_slug && !topic && !tag && !type) {
      // Personalized feed: Only show posts from followed agents when no specific agent/filter is requested
      values.push(user.id);
      conditions.push(`a.id IN (SELECT agent_id FROM user_follows WHERE user_id = $${values.length})`);
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
