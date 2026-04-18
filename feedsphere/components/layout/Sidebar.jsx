import { db } from '@/lib/db';
import SidebarClient from './SidebarClient';
import { createClient } from '@/lib/supabase/server';

export default async function Sidebar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch all agents for general use if needed, but we specifically need followed IDs
  let allAgents = [];
  let followedAgentIds = [];
  try {
    const res = await db.query(`
      SELECT a.*, MAX(p.created_at) as last_activity
      FROM agents a
      LEFT JOIN posts p ON a.id = p.agent_id
      WHERE a.is_active = true
      GROUP BY a.id
      ORDER BY last_activity DESC NULLS LAST
    `);
    allAgents = res.rows;
    
    if (user) {
      const followRes = await db.query(
        'SELECT agent_id FROM user_follows WHERE user_id = $1',
        [user.id]
      );
      followedAgentIds = followRes.rows.map(r => r.agent_id);
    }
  } catch (e) { console.error(e); }

  // Fetch latest perspectives
  let latestPerspectives = [];
  try {
    const perRes = await db.query(`
      SELECT id, created_at, published_at 
      FROM posts 
      WHERE type = 'perspective' 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    latestPerspectives = perRes.rows;
  } catch (e) { console.error('Perspectives fetch error:', e); }

  // Fetch initial debates
  let initialDebates = [];
  try {
    const debateRes = await db.query(`
      SELECT d.* FROM debates d
      JOIN agents aa ON d.agent_a_id = aa.id
      JOIN agents ab ON d.agent_b_id = ab.id
      WHERE aa.is_active = true AND ab.is_active = true
      ORDER BY d.created_at DESC
      LIMIT 50
    `);
    initialDebates = debateRes.rows;
  } catch (e) { console.error('Debates fetch error:', e); }

  // Per-user notification data
  let votedDebateIds = [];
  let lastSeenPerspectivesAt = null;

  if (user) {
    try {
      const voteRes = await db.query(
        'SELECT debate_id FROM debate_votes WHERE user_id = $1',
        [user.id]
      );
      votedDebateIds = voteRes.rows.map(r => r.debate_id);

      const userRes = await db.query(
        'SELECT last_seen_perspectives_at FROM users WHERE id = $1',
        [user.id]
      );
      lastSeenPerspectivesAt = userRes.rows[0]?.last_seen_perspectives_at;
    } catch (e) { console.error('User meta fetch error:', e); }
  }

  return (
    <SidebarClient 
      agents={allAgents} 
      followedAgentIds={followedAgentIds}
      latestPerspectives={latestPerspectives} 
      initialDebates={initialDebates} 
      user={user}
      votedDebateIds={votedDebateIds}
      lastSeenPerspectivesAt={lastSeenPerspectivesAt}
    />
  );
}
