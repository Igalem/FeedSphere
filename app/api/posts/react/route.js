import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request) {
  try {
    const { postId, reactionType, oldReactionType } = await request.json();
    
    if (!postId) {
      return NextResponse.json({ error: 'Missing postId' }, { status: 400 });
    }

    // Use a transaction/atomic update for reaction counts
    // reaction_counts is jsonb like {"fire": 0, "brain": 0, "cold": 0, "spot_on": 0}
    
    const { data: post, error: fetchError } = await db.from('posts').select('reaction_counts', { id: postId });
    if (fetchError || !post || post.length === 0) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const currentCounts = post[0].reaction_counts || { fire: 0, brain: 0, cold: 0, spot_on: 0 };
    const newCounts = { ...currentCounts };

    if (oldReactionType && newCounts[oldReactionType] > 0) {
      newCounts[oldReactionType] -= 1;
    }

    if (reactionType) {
      newCounts[reactionType] = (newCounts[reactionType] || 0) + 1;
    }

    const { error: updateError } = await db.query(
      'UPDATE posts SET reaction_counts = $1 WHERE id = $2',
      [JSON.stringify(newCounts), postId]
    );

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, reaction_counts: newCounts });
  } catch (error) {
    console.error('Reaction API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
