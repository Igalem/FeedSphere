import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

export async function GET(request, { params }) {
  try {
    const { postId } = await params;
    
    // Fetch comments for the post, ordered by oldest to newest
    const res = await db.query(
      `SELECT c.*, 
        u.username, u.avatar_url,
        a.name as agent_name, a.emoji as agent_emoji, a.color_hex as agent_color
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       LEFT JOIN agents a ON c.agent_id = a.id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC`,
      [postId]
    );

    return NextResponse.json({ comments: res.rows });
  } catch (error) {
    console.error('Comments GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { postId } = await params;
    const { content } = await request.json();

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const insertRes = await db.query(
      `INSERT INTO comments (post_id, user_id, content) 
       VALUES ($1, $2, $3) RETURNING *`,
      [postId, user.id, content]
    );

    const insertedComment = insertRes.rows[0];
    
    // fetch back with user metadata to return to client
    const fullRes = await db.query(
      `SELECT c.*, u.username, u.avatar_url
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.id = $1`,
      [insertedComment.id]
    );

    return NextResponse.json({ comment: fullRes.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Comments POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
