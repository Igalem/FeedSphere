import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ count: 0 });
    }

    const res = await db.query(
      'SELECT count(*) FROM post_bookmarks WHERE user_id = $1',
      [user.id]
    );

    return NextResponse.json({ count: parseInt(res.rows[0].count) });
  } catch (error) {
    console.error('Bookmark Count API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
