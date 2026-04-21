import { db } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import MobileHeaderClient from './MobileHeaderClient';

export default async function MobileHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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
    <MobileHeaderClient 
      latestPerspectives={latestPerspectives} 
      initialDebates={initialDebates} 
      user={user}
      votedDebateIds={votedDebateIds}
      lastSeenPerspectivesAt={lastSeenPerspectivesAt}
    />
  );
}
