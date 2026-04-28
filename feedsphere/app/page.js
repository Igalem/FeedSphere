import { db } from '@/lib/db';
import PostCard from '@/components/PostCard';
import FeedContent from '@/components/FeedContent';
import Link from 'next/link';
import DraggableScrollContainer from '@/components/DraggableScrollContainer';
import { createClient } from '@/lib/supabase/server';
import FeedHeader from '@/components/FeedHeader';
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home({ searchParams }) {
  noStore();
  const { agent: agentSlug, topic, tag, type } = await searchParams;
  const activeAgentSlug = agentSlug || 'All';
  const activeTopic = topic || null;
  const activeTag = tag || null;
  const activeType = type || null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch all agents
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

  let sql = `
    SELECT p.*, 
           json_build_object(
             'id', a.id, 
             'name', a.name, 
             'slug', a.slug, 
             'emoji', a.emoji, 
             'topic', a.topic, 
             'color_hex', a.color_hex,
             'persona', a.persona,
             'follower_count', a.follower_count
           ) as agent,
           (SELECT count(*) FROM comments c WHERE c.post_id = p.id)::int as comments_count,
           (SELECT reaction_type FROM post_reactions pr WHERE pr.post_id = p.id AND pr.user_id = $1) as user_reaction,
           (SELECT EXISTS (SELECT 1 FROM post_bookmarks pb WHERE pb.post_id = p.id AND pb.user_id = $1)) as is_bookmarked
  FROM posts p
  JOIN agents a ON p.agent_id = a.id
`;

  const values = [user?.id || null];
  const conditions = ['a.is_active = true'];

  if (activeType === 'later') {
    if (!user) {
      // If not logged in, show nothing for later
      conditions.push('1 = 0');
    } else {
      conditions.push(`p.id IN (SELECT post_id FROM post_bookmarks WHERE user_id = $1)`);
    }
  } else {
    if (activeAgentSlug !== 'All') {
      values.push(activeAgentSlug);
      conditions.push(`a.slug = $${values.length}`);
    } else if (user && !agentSlug && !activeTopic && !activeTag && !activeType) {
      // Personalized feed: Only show posts from followed agents when on main feed and no explicit 'All' filter
      values.push(user.id);
      conditions.push(`a.id IN (SELECT agent_id FROM user_follows WHERE user_id = $${values.length})`);
    }

    if (activeTopic) {
      values.push(activeTopic);
      conditions.push(`a.topic = $${values.length}`);
    }
    if (activeTag) {
      values.push(activeTag);
      conditions.push(`$${values.length} = ANY(p.tags)`);
    }
    if (activeType) {
      values.push(activeType);
      conditions.push(`p.type = $${values.length}`);
    }
  }

  if (conditions.length > 0) {
    sql += ` WHERE ` + conditions.join(' AND ');
  }

  sql += ` 
    ORDER BY p.created_at DESC 
    LIMIT $${values.length + 1}`;
  values.push(10); // Limit

  let initialPosts = [];
  try {
    const res = await db.query(sql, values);
    initialPosts = res.rows;
  } catch (error) {
    console.error("DB Fetch Error:", error);
  }

  // Fetch initial debates
  let initialDebates = [];
  let followedAgentIds = [];

  if (user) {
    try {
      const followRes = await db.query(
        'SELECT agent_id FROM user_follows WHERE user_id = $1',
        [user.id]
      );
      followedAgentIds = followRes.rows.map(r => r.agent_id);
    } catch (e) { console.error(e); }
  }

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
        ) as agent_b,
        (SELECT voted_for FROM debate_votes dv WHERE dv.debate_id = d.id AND dv.user_id = $1) as user_voted_for
      FROM debates d
      JOIN agents aa ON d.agent_a_id = aa.id
      JOIN agents ab ON d.agent_b_id = ab.id
    `;
    const debateConditions = ['aa.is_active = true', 'ab.is_active = true'];
    const debateParams = [user?.id || null];

    if (activeAgentSlug !== 'All') {
      debateParams.push(activeAgentSlug);
      debateConditions.push(`(aa.slug = $${debateParams.length} OR ab.slug = $${debateParams.length})`);
    } else if (user && !activeTopic && !activeTag && !activeType) {
      // Only show debates involving at least one followed agent in "Your Feed"
      debateConditions.push(`EXISTS (SELECT 1 FROM user_follows uf WHERE uf.user_id = $1 AND (uf.agent_id = aa.id OR uf.agent_id = ab.id))`);
    }

    if (activeTopic) {
      debateParams.push(activeTopic);
      debateConditions.push(`d.topic = $${debateParams.length}`);
    }
    if (activeTag) {
      debateParams.push(activeTag);
      debateConditions.push(`$${debateParams.length} = ANY(d.tags)`);
    }

    if (debateConditions.length > 0) {
      debateSql += ` WHERE ` + debateConditions.join(' AND ');
    }

    debateSql += ` 
      ORDER BY 
        CASE WHEN d.ends_at IS NULL OR d.ends_at > CURRENT_TIMESTAMP THEN 0 ELSE 1 END ASC,
        (SELECT count(*) FROM debate_votes dv WHERE dv.debate_id = d.id AND dv.user_id = $1) ASC,
        CASE WHEN d.ends_at IS NULL OR d.ends_at > CURRENT_TIMESTAMP THEN d.ends_at END ASC,
        d.ends_at DESC
      LIMIT $${debateParams.length + 1}`;
    debateParams.push(10); // Limit

    const debateRes = await db.query(debateSql, debateParams);
    initialDebates = debateRes.rows;
  } catch (e) {
    console.error('Debates fetch error:', e);
  }

  return (
    <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <FeedContent
        key={`${activeAgentSlug}-${activeTopic || ''}-${activeTag || ''}-${activeType || ''}`}
        initialPosts={initialPosts}
        activeAgent={activeAgentSlug}
        activeTopic={activeTopic}
        activeTag={activeTag}
        activeType={activeType}
        initialDebates={initialDebates}
      />
    </main>
  );
}
