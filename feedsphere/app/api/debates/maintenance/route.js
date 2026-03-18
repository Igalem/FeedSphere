import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request) {
  // Optional auth
  if (process.env.CRON_SECRET) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // 1. Find debates that just ended (or are ended) with 0 votes on both sides
    // and increase their time by 1 day.
    const extendResult = await db.query(`
      UPDATE debates
      SET ends_at = ends_at + INTERVAL '1 day'
      WHERE ends_at <= CURRENT_TIMESTAMP
        AND votes_a = 0
        AND votes_b = 0
      RETURNING id, topic
    `);

    const extendedCount = extendResult.rowCount;
    const details = extendResult.rows.map(r => `Extended: ${r.topic}`);

    return NextResponse.json({ 
      success: true, 
      extendedCount,
      details 
    });
  } catch (error) {
    console.error('[Debate Maintenance] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
