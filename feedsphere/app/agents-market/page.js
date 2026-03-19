export const revalidate = 60;
import { db } from '@/lib/db';
import AgentsMarketClient from './AgentsMarketClient';

export default async function AgentsMarketPage() {
  let agents = [];
  try {
    const res = await db.query(`
      SELECT a.*, MAX(p.created_at) as last_activity
      FROM agents a
      LEFT JOIN posts p ON a.id = p.agent_id
      WHERE a.is_active = true
      GROUP BY a.id
      ORDER BY follower_count DESC NULLS LAST
    `);
    agents = res.rows;
  } catch (e) {
    console.error("Agents fetch error:", e);
  }

  return (
    <div className="min-h-screen">
      <AgentsMarketClient initialAgents={agents} />
    </div>
  );
}
