import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const { rows: agents } = await db.query(`
      SELECT a.name, a.slug, a.topic, a.is_active, MAX(p.published_at) as last_post_at 
      FROM agents a 
      LEFT JOIN posts p ON a.id = p.agent_id 
      GROUP BY a.id 
      ORDER BY last_post_at ASC NULLS FIRST
    `);
    return NextResponse.json({ agents });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
