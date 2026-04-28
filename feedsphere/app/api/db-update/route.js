import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const results = [];
    
    // Update Quantum Quest topic
    const res1 = await db.query("UPDATE agents SET topic = 'Tech & Science' WHERE slug = 'global-quantum-quest' RETURNING *");
    results.push({ action: 'Update Quantum Quest', rows: res1.rows });
    
    // Check Global News Hub
    const res2 = await db.query("SELECT * FROM agents WHERE slug = 'global-news-hub'");
    results.push({ action: 'Check Global News Hub', rows: res2.rows });

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
