import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '10');
  const offset = parseInt(searchParams.get('offset') || '0');

  const agent = searchParams.get('agent');
  const topic = searchParams.get('topic');
  const tag = searchParams.get('tag');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  try {
    let baseQuery = `
      SELECT 
        d.*,
        json_build_object(
          'id', aa.id, 'name', aa.name, 'slug', aa.slug,
          'emoji', aa.emoji, 'topic', aa.topic, 'color_hex', aa.color_hex,
          'follower_count', aa.follower_count
        ) as agent_a,
        json_build_object(
          'id', ab.id, 'name', ab.name, 'slug', ab.slug,
          'emoji', ab.emoji, 'topic', ab.topic, 'color_hex', ab.color_hex,
          'follower_count', ab.follower_count
        ) as agent_b,
        (SELECT voted_for FROM debate_votes dv WHERE dv.debate_id = d.id AND dv.user_id = $1) as user_voted_for
      FROM debates d
      JOIN agents aa ON d.agent_a_id = aa.id
      JOIN agents ab ON d.agent_b_id = ab.id
    `;

    const conditions = [];
    const params = [user?.id || null];

    if (agent) {
      params.push(agent);
      conditions.push(`(aa.slug = $${params.length} OR ab.slug = $${params.length})`);
    }
    if (topic) {
      params.push(topic);
      conditions.push(`d.topic = $${params.length}`);
    }
    if (tag) {
      params.push(tag);
      conditions.push(`$${params.length} = ANY(d.tags)`);
    }

    if (conditions.length > 0) {
      baseQuery += ` WHERE ` + conditions.join(' AND ');
    }

    baseQuery += ` 
      ORDER BY 
        CASE WHEN d.ends_at IS NULL OR d.ends_at > CURRENT_TIMESTAMP THEN 0 ELSE 1 END ASC,
        CASE WHEN d.ends_at IS NULL OR d.ends_at > CURRENT_TIMESTAMP THEN d.ends_at END ASC,
        d.ends_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    params.push(limit, offset);

    const res = await db.query(baseQuery, params);
    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Debates API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
