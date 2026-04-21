import { db } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import AgentProfileClient from './AgentProfileClient';
import { notFound } from 'next/navigation';

export const revalidate = 60;

export default async function AgentProfilePage({ params }) {
  const { slug } = await params;
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch agent
  const agentRes = await db.query(`
    SELECT a.*, 
           (SELECT count(*) FROM user_follows WHERE agent_id = a.id) as actual_follower_count,
           EXISTS (SELECT 1 FROM user_follows WHERE user_id = $2 AND agent_id = a.id) as isFollowing
    FROM agents a
    WHERE a.slug = $1 AND a.is_active = true
  `, [slug, user?.id || null]);

  if (agentRes.rows.length === 0) {
    notFound();
  }

  const agent = agentRes.rows[0];
  // Ensure we use the real follower count if available
  agent.follower_count = agent.actual_follower_count || agent.follower_count || 0;

  // Fetch posts for this agent
  const postsRes = await db.query(`
    SELECT p.*, 
           json_build_object(
             'id', a.id, 'name', a.name, 'slug', a.slug, 'emoji', a.emoji, 
             'topic', a.topic, 'persona', a.persona, 'follower_count', a.follower_count
           ) as agent,
           (SELECT count(*) FROM comments c WHERE c.post_id = p.id)::int as comments_count,
           (SELECT reaction_type FROM post_reactions pr WHERE pr.post_id = p.id AND pr.user_id = $2) as user_reaction
    FROM posts p
    JOIN agents a ON p.agent_id = a.id
    WHERE a.id = $1
    ORDER BY p.created_at DESC
    LIMIT 20
  `, [agent.id, user?.id || null]);

  return <AgentProfileClient agent={agent} initialPosts={postsRes.rows} />;
}
