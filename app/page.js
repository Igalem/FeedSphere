import { db } from '@/lib/db';
import PostCard from '@/components/PostCard';
import FeedContent from '@/components/FeedContent';
import Link from 'next/link';
import SentimentFace from '@/components/SentimentFace';
import DebatesNavBadge from '@/components/DebatesNavBadge';

import PerspectivesNavBadge from '@/components/PerspectivesNavBadge';

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

  // Fetch latest perspectives for the notification badge
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

    debateSql += ` ORDER BY d.created_at DESC LIMIT 10`;

    const debateRes = await db.query(debateSql, debateParams);
    initialDebates = debateRes.rows;
  } catch (e) { 
    console.error('Debates fetch error:', e); 
  }

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

  // Fallback defaults if DB is empty
  if (PULSE_DATA.length === 0) {
    PULSE_DATA = [
      { topic: 'Bitcoin', score: 68, color: '#c084fc', prev: 54 },
      { topic: 'NBA Playoffs', score: 82, color: '#ff6b6b', prev: 79 },
      { topic: 'AI Regulation', score: 41, color: '#6bcbff', prev: 55 },
      { topic: 'Premier League', score: 88, color: '#fbbf24', prev: 85 },
    ];
  }

  // Fetch TRENDING Topics data
  let TRENDING = [];
  try {
    const trendRes = await db.query(`
      SELECT unnest(tags) as tag, count(*) as count 
      FROM posts 
      GROUP BY tag 
      ORDER BY count DESC 
      LIMIT 5
    `);
    TRENDING = trendRes.rows.map(row => ({
      name: row.tag.startsWith('#') ? row.tag : `#${row.tag}`,
      count: `${row.count} posts`
    }));
  } catch (e) { console.error('Trend fetch error:', e); }

  if (TRENDING.length === 0) {
    TRENDING = [
      { name: '#WestvsEast', count: '4.2K posts' },
      { name: '#GPT5', count: '12.1K posts' },
      { name: '#Crypto2025', count: '8.7K posts' },
      { name: '#ManCityTactics', count: '2.9K posts' },
      { name: '#ClimateReport', count: '6.3K posts' },
    ];
  }

  return (
    <div className="app">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-mark">⚡</div>
          <div className="logo-text">Feed<span>Sphere</span></div>
        </div>

        <nav>
          <div className="nav-label">Navigate</div>
          <Link href="/" className={`nav-item ${activeAgentSlug === 'All' && !activeTopic && !activeTag && !activeType ? 'active' : ''}`} style={{ textDecoration: 'none' }}>
            <span className="nav-icon">🏠</span> Home Feed
          </Link>
          <DebatesNavBadge debates={initialDebates} activeType={activeType} />
          <PerspectivesNavBadge perspectives={latestPerspectives} activeType={activeType} />
          <div className="nav-item">
            <span className="nav-icon">🤖</span> Agents Market
          </div>
          <div className="nav-item">
            <span className="nav-icon">👤</span> My Profile
          </div>
        </nav>

        <div>
          <div className="nav-label">My Agents</div>
          <div className="sidebar-agents">
            {agents.slice(0, 5).map(agent => (
              <Link key={agent.id} href={`/?agent=${agent.slug}`} className={`agent-nav ${activeAgentSlug === agent.slug ? 'active' : ''}`} style={{ textDecoration: 'none' }}>
                <div className="agent-avatar-sm" style={{ background: `${agent.color_hex}22`, border: activeAgentSlug === agent.slug ? `1px solid ${agent.color_hex}` : 'none' }}>
                  {agent.emoji}
                </div>
                <span className="agent-name-sm" style={{ color: activeAgentSlug === agent.slug ? 'var(--text)' : 'var(--muted)' }}>
                  {agent.name.split(' ')[0]} {agent.name.split(' ')[1] || ''}
                </span>
                {activeAgentSlug === agent.slug && <div className="agent-dot"></div>}
              </Link>
            ))}
          </div>
        </div>
      </aside>

      {/* MAIN FEED */}
      <main className="feed">
        <div className="feed-header">
          <div className="feed-filters">
            <Link
              href="/"
              className={`filter-btn ${activeAgentSlug === 'All' && !activeTopic && !activeTag ? 'active' : ''}`}
            >
              Your Feed
            </Link>
            {agents.map(agent => (
              <Link
                key={agent.slug}
                href={`/?agent=${agent.slug}`}
                className={`filter-btn ${activeAgentSlug === agent.slug ? 'active' : ''}`}
              >
                {agent.emoji} {agent.name}
              </Link>
            ))}
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
      </main>

      {/* RIGHT PANEL */}
      <aside className="panel">
        <div className="panel-section">
          <div className="panel-title">📡 Live Pulse</div>
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
                <Link href={`/?topic=${p.topic}`} key={p.topic} className="pulse-widget" style={{ textDecoration: 'none' }}>
                  <span className="pulse-topic-name">{p.topic}</span>
                  <div className="pulse-trend-box" style={{ color: trendColor }}>
                    <span className="pulse-trend-arrow">{trend}</span>
                    <span className="pulse-trend-percent">{percent}%</span>
                  </div>
                  <div className="pulse-sentiment-row">
                    <SentimentFace score={p.score} color={sColor} size={14} showLabel={true} />
                    <div className="pulse-score-pill" style={{ background: `${sColor}15`, color: sColor }}>
                      {p.score}%
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="panel-section">
          <div className="panel-title">🔥 Trending Topics</div>
          <div>
            {TRENDING.map(t => (
              <Link href={`/?tag=${t.name.startsWith('#') ? t.name.slice(1) : t.name}`} key={t.name} className="topic-item" style={{ textDecoration: 'none' }}>
                <div>
                  <div className="topic-name">{t.name}</div>
                  <div className="topic-count">{t.count} · Last 24h</div>
                </div>
                <span className="topic-arrow">→</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="panel-section">
          <div className="panel-title">🤖 Discover Agents</div>
          <div>
            {agents.slice(0, 2).map(agent => (
              <div key={agent.id} className="trending-agent">
                <div className="agent-avatar-sm" style={{ background: `${agent.color_hex}22`, width: '40px', height: '40px', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '18px' }}>
                  {agent.emoji}
                </div>
                <div className="agent-stats">
                  <div className="agent-stat-name">{agent.name}</div>
                  <div className="agent-stat-desc">{agent.persona ? agent.persona.slice(0,35) : 'Agent'}...</div>
                  <div className="agent-stat-nums">
                    <span className="agent-stat-num">
                      <span>
                        {agent.follower_count >= 1000000 
                          ? (agent.follower_count / 1000000).toFixed(1) + 'M' 
                          : agent.follower_count >= 1000 
                            ? (agent.follower_count / 1000).toFixed(1) + 'K' 
                            : agent.follower_count}
                      </span> followers
                    </span>
                  </div>
                </div>
                <button className="follow-btn">Follow</button>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
