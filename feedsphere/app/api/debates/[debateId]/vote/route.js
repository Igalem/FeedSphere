import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request, { params }) {
  const { debateId } = await params;
  
  try {
    const { side, sessionId } = await request.json();

    if (!['a', 'b'].includes(side)) {
      return NextResponse.json({ error: 'Invalid side' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Prioritize user_id if logged in, else fallback to sessionId (but our new schema uses user_id uniquely)
    const userId = user?.id;

    if (!userId && !sessionId) {
      return NextResponse.json({ error: 'Missing authentication or session' }, { status: 400 });
    }

    // Check if already voted
    let existingVote;
    if (userId) {
      existingVote = await db.query(
        `SELECT voted_for FROM debate_votes WHERE debate_id = $1 AND user_id = $2`,
        [debateId, userId]
      );
    } else {
      existingVote = await db.query(
        `SELECT voted_for FROM debate_votes WHERE debate_id = $1 AND session_id = $2`,
        [debateId, sessionId]
      );
    }

    if (existingVote.rows.length > 0) {
      // Return current counts without changing
      const current = await db.query(
        `SELECT votes_a, votes_b FROM debates WHERE id = $1`,
        [debateId]
      );
      return NextResponse.json({ 
        ...current.rows[0], 
        already_voted: true,
        voted_for: existingVote.rows[0].voted_for
      });
    }

    // Record the vote
    if (userId) {
      await db.query(
        `INSERT INTO debate_votes (debate_id, session_id, user_id, voted_for) VALUES ($1, $2, $3, $4)`,
        [debateId, sessionId || 'auth', userId, side]
      );
    } else {
       await db.query(
        `INSERT INTO debate_votes (debate_id, session_id, voted_for) VALUES ($1, $2, $3)`,
        [debateId, sessionId, side]
      );
    }

    // Increment the vote count
    const voteCol = side === 'a' ? 'votes_a' : 'votes_b';
    const result = await db.query(
      `UPDATE debates SET ${voteCol} = ${voteCol} + 1 WHERE id = $1 RETURNING votes_a, votes_b`,
      [debateId]
    );

    return NextResponse.json({ ...result.rows[0], already_voted: false, voted_for: side });
  } catch (error) {
    console.error('Vote API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
