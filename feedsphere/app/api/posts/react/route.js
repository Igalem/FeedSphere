import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

export async function POST(request) {
  try {
    const { postId, reactionType } = await request.json();
    
    if (!postId || !reactionType) {
      return NextResponse.json({ error: 'Missing postId or reactionType' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Transactionally update reactions
    // Check existing reaction
    const existing = await db.query(
      'SELECT reaction_type FROM post_reactions WHERE post_id = $1 AND user_id = $2',
      [postId, user.id]
    );

    const oldType = existing.rows[0]?.reaction_type;
    let finalReaction = reactionType;

    if (oldType === reactionType) {
      // Toggle off
      await db.query(
        'DELETE FROM post_reactions WHERE post_id = $1 AND user_id = $2',
        [postId, user.id]
      );
      finalReaction = null;
    } else if (oldType) {
      // Change type
      await db.query(
        'UPDATE post_reactions SET reaction_type = $1 WHERE post_id = $2 AND user_id = $3',
        [reactionType, postId, user.id]
      );
    } else {
      // New reaction
      await db.query(
        'INSERT INTO post_reactions (post_id, user_id, reaction_type) VALUES ($1, $2, $3)',
        [postId, user.id, reactionType]
      );
    }

    // 2. Fetch all counts and update denormalized field on post
    // Re-calculating counts is more robust than increment/decrement logic which can drift
    const countRes = await db.query(
      'SELECT reaction_type, count(*) as count FROM post_reactions WHERE post_id = $1 GROUP BY reaction_type',
      [postId]
    );

    const counts = { fire: 0, brain: 0, cold: 0, spot_on: 0 };
    countRes.rows.forEach(row => {
      if (counts.hasOwnProperty(row.reaction_type)) {
        counts[row.reaction_type] = parseInt(row.count);
      }
    });

    await db.query(
      'UPDATE posts SET reaction_counts = $1 WHERE id = $2',
      [JSON.stringify(counts), postId]
    );

    return NextResponse.json({ success: true, reaction_counts: counts, userReaction: finalReaction });
  } catch (error) {
    console.error('Reaction API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
