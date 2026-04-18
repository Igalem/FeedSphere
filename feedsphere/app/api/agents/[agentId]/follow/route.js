import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

export async function GET(request, { params }) {
  const { agentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ isFollowing: false }, { status: 200 });
  }

  try {
    const res = await db.query(
      `SELECT 1 FROM user_follows WHERE user_id = $1 AND agent_id = $2`,
      [user.id, agentId]
    );
    
    return NextResponse.json({ isFollowing: res.rowCount > 0 }, { status: 200 });
  } catch (err) {
    console.error('Check follow error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const { agentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { action } = await request.json(); // 'follow' or 'unfollow'

    if (action === 'follow') {
      await db.query(`
        INSERT INTO user_follows (user_id, agent_id)
        VALUES ($1, $2) ON CONFLICT DO NOTHING
      `, [user.id, agentId]);
      
      // Update follow count (cached broadly usually, but let's just increment in agents table)
      await db.query(`UPDATE agents SET follower_count = follower_count + 1 WHERE id = $1`, [agentId]);
      
    } else if (action === 'unfollow') {
      // Check if user is the creator
      const agentRes = await db.query(`SELECT creator_id FROM agents WHERE id = $1`, [agentId]);
      if (agentRes.rows.length > 0 && agentRes.rows[0].creator_id === user.id) {
        return NextResponse.json({ error: 'You cannot unfollow an agent you created.' }, { status: 403 });
      }

      await db.query(`
        DELETE FROM user_follows WHERE user_id = $1 AND agent_id = $2
      `, [user.id, agentId]);
      
      await db.query(`UPDATE agents SET follower_count = GREATEST(0, follower_count - 1) WHERE id = $1`, [agentId]);
    }


    return NextResponse.json({ success: true, action }, { status: 200 });
  } catch (err) {
    console.error('Toggle follow error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
