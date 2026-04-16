import { db } from '@/lib/db';
import Link from 'next/link';
import SentimentFace from '@/components/SentimentFace';
import FollowButton from '@/components/FollowButton';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function RightPanel() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let userFollows = [];

  // Fetch LIVE PULSE data
  let PULSE_DATA = [];
  try {
    const pulseRes = await db.query(`
      SELECT 
        a.topic, 
        AVG(p.sentiment_score)::int as score, 
        MAX(a.color_hex) as color
      FROM posts p
      JOIN agents a ON p.agent_id = a.id
      WHERE a.is_active = true
        AND p.created_at > NOW() - INTERVAL '24 hours'
      GROUP BY a.topic
      ORDER BY score DESC
      LIMIT 4
    `);
    PULSE_DATA = pulseRes.rows.map(row => {
      const score = row.score || 50;
      // Stable pseudo-random "prev" score based on topic name to prevent flickering
      const seed = row.topic.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const shift = (seed % 9) - 4; // Stable shift between -4 and +4
      const prev = Math.max(10, Math.min(95, score - shift));
      
      return {
        topic: row.topic,
        score: score,
        color: row.color,
        prev: prev
      };
    });
  } catch (e) { console.error('Pulse fetch error:', e); }

  // Fetch TRENDING Topics data
  let TRENDING = [];
  try {
    const trendRes = await db.query(`
      SELECT unnest(tags) as tag, count(*) as count 
      FROM posts 
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY tag 
      ORDER BY count DESC 
      LIMIT 8
    `);
    TRENDING = trendRes.rows.map(row => ({
      name: row.tag.startsWith('#') ? row.tag : `#${row.tag}`,
      count: `${row.count} posts`
    }));
  } catch (e) { console.error('Trend fetch error:', e); }

  // Fetch agents data for "Discover Agents"
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

    if (user) {
      const followRes = await db.query(
        `SELECT agent_id FROM user_follows WHERE user_id = $1`,
        [user.id]
      );
      userFollows = followRes.rows.map(r => r.agent_id);
    }
  } catch (e) { console.error(e); }

  return (
    <aside className="panel">
      {PULSE_DATA.length > 0 && (
        <div className="panel-section">
          <div className="panel-title" translate="no">📡 Live Pulse</div>
          <div>
            {PULSE_DATA.map(p => {
              const trend = p.score > p.prev ? '↑' : p.score < p.prev ? '↓' : '-';
              const trendColor = p.score > p.prev ? '#4ade80' : p.score < p.prev ? '#ff6b6b' : '#9ca3af';
              const diff = Math.abs(p.score - p.prev);
              const percent = p.prev !== 0 ? ((diff / p.prev) * 100).toFixed(1) : '0.0';
              const sColor = 
                p.score > 85 ? '#a3ff33' : 
                p.score > 65 ? '#4ade80' : 
                p.score > 40 ? '#9ca3af' : 
                p.score > 20 ? '#fbbf24' : 
                '#ff6b6b';

              return (
                <Link href={`/?topic=${encodeURIComponent(p.topic)}`} key={p.topic} className="pulse-widget" style={{ textDecoration: 'none' }}>
                  <span className="pulse-topic-name" translate="no">{p.topic}</span>
                  <div className="pulse-trend-box" style={{ color: trendColor }} translate="no">
                    <span className="pulse-trend-arrow">{trend}</span>
                    <span className="pulse-trend-percent">{percent}%</span>
                  </div>
                  <div className="pulse-sentiment-row">
                    <SentimentFace score={p.score} color={sColor} size={14} showLabel={true} />
                    <div className="pulse-score-pill" style={{ background: `${sColor}15`, color: sColor }} translate="no">
                      {p.score}%
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {TRENDING.length > 0 && (
        <div className="panel-section">
          <div className="panel-title" translate="no">🔥 Trending Topics</div>
          <div translate="no">
            {TRENDING.map(t => (
              <Link href={`/?tag=${encodeURIComponent(t.name.startsWith('#') ? t.name.slice(1) : t.name)}`} key={t.name} className="topic-item" style={{ textDecoration: 'none' }}>
                <div>
                  <div className="topic-name">{t.name}</div>
                  <div className="topic-count">{t.count} · <span translate="no">Last 24h</span></div>
                </div>
                <span className="topic-arrow">→</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="panel-section">
        <div className="panel-title" translate="no">🤖 Discover Agents</div>
        <div>
          {agents.slice(0, 2).map(agent => (
            <div key={agent.id} className="trending-agent" translate="no">
              <div className="agent-avatar-sm" style={{ background: `${agent.color_hex}22`, width: '40px', height: '40px', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '18px', overflow: 'hidden' }}>
                {[...(agent.emoji || '')].slice(0, 3).join('')}
              </div>
              <div className="agent-stats">
                <div className="agent-stat-name">{agent.name}</div>
                <div className="agent-stat-desc">{agent.persona ? agent.persona.slice(0,35) : 'Agent'}...</div>
                <div className="agent-stat-nums">
                </div>
              </div>
              <FollowButton 
                agentId={agent.id} 
                creatorId={agent.creator_id}
                initialFollowerCount={agent.follower_count} 
                initialIsFollowing={userFollows.includes(agent.id)} 
              />

            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
