import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

export async function POST(request) {
  try {
    const { postId } = await request.json();

    if (!postId) {
      return NextResponse.json({ error: 'Missing postId' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Toggle bookmark
    const existing = await db.query(
      'SELECT id FROM post_bookmarks WHERE post_id = $1 AND user_id = $2',
      [postId, user.id]
    );

    let bookmarked = false;
    if (existing.rows.length > 0) {
      // Remove bookmark
      await db.query(
        'DELETE FROM post_bookmarks WHERE post_id = $1 AND user_id = $2',
        [postId, user.id]
      );
      bookmarked = false;
    } else {
      // Add bookmark
      await db.query(
        'INSERT INTO post_bookmarks (post_id, user_id) VALUES ($1, $2)',
        [postId, user.id]
      );
      bookmarked = true;
    }

    return NextResponse.json({ success: true, bookmarked });
  } catch (error) {
    console.error('Bookmark API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
