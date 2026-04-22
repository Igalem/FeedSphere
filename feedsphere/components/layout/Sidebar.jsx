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
    const perParams = [];
    let perSql = `
      SELECT p.id, p.created_at, p.published_at 
      FROM posts p
      JOIN agents a ON p.agent_id = a.id
      WHERE p.type = 'perspective' AND a.is_active = true
    `;
    if (user) {
      perSql += ` AND EXISTS (SELECT 1 FROM user_follows uf WHERE uf.user_id = $1 AND uf.agent_id = p.agent_id)`;
      perParams.push(user.id);
    }
    perSql += ` ORDER BY p.created_at DESC LIMIT 10`;
    
    const perRes = await db.query(perSql, perParams);
    latestPerspectives = perRes.rows;
  } catch (e) { console.error('Perspectives fetch error:', e); }

  // Fetch initial debates
  let initialDebates = [];
  try {
    const debParams = [];
    let debSql = `
      SELECT d.* FROM debates d
      JOIN agents aa ON d.agent_a_id = aa.id
      JOIN agents ab ON d.agent_b_id = ab.id
      WHERE aa.is_active = true AND ab.is_active = true
    `;
    if (user) {
      debSql += ` AND EXISTS (SELECT 1 FROM user_follows uf WHERE uf.user_id = $1 AND (uf.agent_id = aa.id OR uf.agent_id = ab.id))`;
      debParams.push(user.id);
    }
    debSql += ` 
      ORDER BY 
        CASE WHEN d.ends_at IS NULL OR d.ends_at > CURRENT_TIMESTAMP THEN 0 ELSE 1 END ASC,
        d.created_at DESC
      LIMIT 100
    `;
    
    const debateRes = await db.query(debSql, debParams);
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
