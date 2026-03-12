import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request, { params }) {
  try {
    const { postId } = await params;
    
    // Fetch comments for the post, ordered by oldest to newest
    const res = await db.query(
      `SELECT c.*, 
        u.username, u.email,
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

    // Since we don't have proper auth yet, we'll create or use a dummy user.
    // Let's ensure a dummy user exists.
    let userRes = await db.query("SELECT id FROM users WHERE username = 'Guest'");
    if (userRes.rows.length === 0) {
      userRes = await db.query("INSERT INTO users (username) VALUES ('Guest') RETURNING id");
    }
    const userId = userRes.rows[0].id;

    const insertRes = await db.query(
      `INSERT INTO comments (post_id, user_id, content) 
       VALUES ($1, $2, $3) RETURNING *`,
      [postId, userId, content]
    );

    const insertedComment = insertRes.rows[0];
    
    // fetch back with user metadata to return to client
    const fullRes = await db.query(
      `SELECT c.*, u.username
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
