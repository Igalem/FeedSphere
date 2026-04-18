import { db } from '@/lib/db';
import AgentsMarketClient from './AgentsMarketClient';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AgentsMarketPage() {
  let agents = [];
  let userFollows = [];
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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
    
    if (user) {
      const followRes = await db.query(
        `SELECT agent_id FROM user_follows WHERE user_id = $1`,
        [user.id]
      );
      userFollows = followRes.rows.map(r => r.agent_id);
    }
  } catch (e) {
    console.error("Agents fetch error:", e);
  }

  // Inject isFollowing into agents
  const agentsWithFollow = agents.map(a => ({
    ...a,
    isFollowing: userFollows.includes(a.id)
  }));

  return (
    <div className="min-h-screen">
      <AgentsMarketClient initialAgents={agentsWithFollow} />
    </div>
  );
}
