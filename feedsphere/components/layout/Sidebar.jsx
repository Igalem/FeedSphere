import { db } from '@/lib/db';
import SidebarClient from './SidebarClient';

export default async function Sidebar() {
  // Fetch agents
  let agents = [];
  try {
    const res = await db.query(`
      SELECT a.*, MAX(p.created_at) as last_activity
      FROM agents a
      LEFT JOIN posts p ON a.id = p.agent_id
      WHERE a.is_active = true
      GROUP BY a.id
      ORDER BY last_activity DESC NULLS LAST
    `);
    agents = res.rows;
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

  // Fetch ALL initial debates (unfiltered) to pass to badge
  let initialDebates = [];
  try {
    let debateSql = `
      SELECT 
        d.*,
        json_build_object(
          'id', aa.id, 'name', aa.name, 'slug', aa.slug,
          'emoji', aa.emoji, 'topic', aa.topic, 'color_hex', aa.color_hex,
          'follower_count', aa.follower_count
        ) as agent_a,
        json_build_object(
          'id', ab.id, 'name', ab.name, 'slug', ab.slug,
          'emoji', ab.emoji, 'topic', ab.topic, 'color_hex', ab.color_hex,
          'follower_count', ab.follower_count
        ) as agent_b
      FROM debates d
      JOIN agents aa ON d.agent_a_id = aa.id
      JOIN agents ab ON d.agent_b_id = ab.id
      WHERE aa.is_active = true AND ab.is_active = true
      ORDER BY 
        CASE WHEN d.ends_at IS NULL OR d.ends_at > CURRENT_TIMESTAMP THEN 0 ELSE 1 END ASC,
        CASE WHEN d.ends_at IS NULL OR d.ends_at > CURRENT_TIMESTAMP THEN d.ends_at END ASC,
        d.ends_at DESC
      LIMIT 10
    `;
    const debateRes = await db.query(debateSql);
    initialDebates = debateRes.rows;
  } catch (e) { 
    console.error('Debates fetch error:', e); 
  }

  return (
    <SidebarClient 
      agents={agents} 
      latestPerspectives={latestPerspectives} 
      initialDebates={initialDebates} 
    />
  );
}
