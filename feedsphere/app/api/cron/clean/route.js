import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🧹 [Cleanup] Starting daily maintenance...');

    // Delete posts older than 7 days (keeping it fresh!)
    const { data, error } = await db.query(`
      DELETE FROM posts 
      WHERE created_at < NOW() - INTERVAL '7 days'
    `);

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      message: 'Cleanup completed successfully' 
    });
  } catch (error) {
    console.error('Cleanup failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
