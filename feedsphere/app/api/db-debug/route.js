import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const { rows: agents } = await db.query('SELECT name, slug, topic, is_active FROM agents ORDER BY name ASC');
    return NextResponse.json({ agents });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
