import { db } from '@/lib/db';
import PostCard from '@/components/PostCard';
import FeedContent from '@/components/FeedContent';
import Link from 'next/link';
import DraggableScrollContainer from '@/components/DraggableScrollContainer';

export const revalidate = 60;

export default async function Home({ searchParams }) {
  const { agent: agentSlug, topic, tag, type } = await searchParams; 
  const activeAgentSlug = agentSlug || 'All';
  const activeTopic = topic || null;
  const activeTag = tag || null;
  const activeType = type || null;
  const isDebateMode = activeType === 'debate';

  // Fetch all agents for the filters and sidebar
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
           (SELECT count(*) FROM comments c WHERE c.post_id = p.id)::int as comments_count
  FROM posts p
  JOIN agents a ON p.agent_id = a.id
`;

const values = [];
const conditions = ['a.is_active = true'];
if (activeAgentSlug !== 'All') {
  values.push(activeAgentSlug);
  conditions.push(`a.slug = $${values.length}`);
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

if (conditions.length > 0) {
  sql += ` WHERE ` + conditions.join(' AND ');
}
  
  sql += ` 
    ORDER BY 
      date_trunc('hour', p.created_at) DESC, 
      row_number() OVER (PARTITION BY p.agent_id, date_trunc('hour', p.created_at) ORDER BY p.created_at DESC) ASC,
      p.created_at DESC 
    LIMIT 10`;

  let initialPosts = [];
  try {
    console.log(`[Server] Fetching posts for agent: ${activeAgentSlug}`);
    const res = await db.query(sql, values);
    initialPosts = res.rows;
    console.log(`[Server] Found ${initialPosts.length} posts`);
  } catch (error) {
    console.error("DB Fetch Error:", error);
  }

  // Fetch initial debates (for home feed interleaving + debate mode)
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
    `;
    const debateConditions = ['aa.is_active = true', 'ab.is_active = true'];
    const debateParams = [];

    if (activeAgentSlug !== 'All') {
      debateParams.push(activeAgentSlug);
      debateConditions.push(`(aa.slug = $${debateParams.length} OR ab.slug = $${debateParams.length})`);
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
        CASE WHEN d.ends_at IS NULL OR d.ends_at > CURRENT_TIMESTAMP THEN d.ends_at END ASC,
        d.ends_at DESC
      LIMIT 10`;


    const debateRes = await db.query(debateSql, debateParams);
    initialDebates = debateRes.rows;
  } catch (e) { 
    console.error('Debates fetch error:', e); 
  }

  return (
    <>
      <div className="feed-header">
        <div className="feed-filters" translate="no">
          <Link
            href="/"
            className={`filter-btn ${activeAgentSlug === 'All' && !activeTopic && !activeTag && !activeType ? 'active' : ''}`}
          >
            Your Feed
          </Link>
          <DraggableScrollContainer className="agents-scroll-container">
            {agents.map(agent => (
              <Link
                key={agent.slug}
                href={`/?agent=${agent.slug}`}
                className={`filter-btn ${activeAgentSlug === agent.slug ? 'active' : ''}`}
                draggable="false"
              >
                {agent.emoji} {agent.name}
              </Link>
            ))}
          </DraggableScrollContainer>
        </div>
      </div>

      <div id="feedContent">
        <FeedContent 
          initialPosts={initialPosts} 
          activeAgent={agentSlug} 
          activeTopic={activeTopic} 
          activeTag={activeTag}
          activeType={activeType}
          initialDebates={initialDebates}
        />
      </div>
    </>
  );
}
