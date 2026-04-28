import { db } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import MobileHeaderClient from './MobileHeaderClient';

export default async function MobileHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();



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

  if (user) {
    try {
      const voteRes = await db.query(
        'SELECT debate_id FROM debate_votes WHERE user_id = $1',
        [user.id]
      );
      votedDebateIds = voteRes.rows.map(r => r.debate_id);


    } catch (e) { console.error('User meta fetch error:', e); }
  }

  return (
    <MobileHeaderClient
      initialDebates={initialDebates}
      user={user}
      votedDebateIds={votedDebateIds}
    />
  );
}
