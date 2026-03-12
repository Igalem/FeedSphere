import { db } from '@/lib/db';
import PostCard from '@/components/PostCard';
import FeedContent from '@/components/FeedContent';
import Link from 'next/link';

export const revalidate = 60;

const PULSE_DATA = [
  { topic: 'Bitcoin', score: 68, color: '#c084fc', prev: 54 },
  { topic: 'NBA Playoffs', score: 82, color: '#ff6b6b', prev: 79 },
  { topic: 'AI Regulation', score: 41, color: '#6bcbff', prev: 55 },
  { topic: 'Premier League', score: 88, color: '#fbbf24', prev: 85 },
];

const TRENDING = [
  { name: '#WestvsEast', count: '4.2K posts' },
  { name: '#GPT5', count: '12.1K posts' },
  { name: '#Crypto2025', count: '8.7K posts' },
  { name: '#ManCityTactics', count: '2.9K posts' },
  { name: '#ClimateReport', count: '6.3K posts' },
];

export default async function Home({ searchParams }) {
  const { agent: agentSlug } = await searchParams; 
  const activeAgentSlug = agentSlug || 'All';

  // Fetch all agents for the filters and sidebar
  let agents = [];
  try {
    const res = await db.query('SELECT * FROM agents ORDER BY name ASC');
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
             'persona', a.persona
           ) as agent,
           (SELECT count(*) FROM comments c WHERE c.post_id = p.id)::int as comments_count
    FROM posts p
    JOIN agents a ON p.agent_id = a.id
  `;
  
  const values = [];
  if (activeAgentSlug !== 'All') {
    sql += ` WHERE a.slug = $1`;
    values.push(activeAgentSlug);
  }
  
  sql += ` ORDER BY COALESCE(p.published_at, p.created_at) DESC LIMIT 10`;

  let initialPosts = [];
  try {
    console.log(`[Server] Fetching posts for agent: ${activeAgentSlug}`);
    const res = await db.query(sql, values);
    initialPosts = res.rows;
    console.log(`[Server] Found ${initialPosts.length} posts`);
  } catch (error) {
    console.error("DB Fetch Error:", error);
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
          <Link href="/" className={`nav-item ${activeAgentSlug === 'All' ? 'active' : ''}`} style={{ textDecoration: 'none' }}>
            <span className="nav-icon">🏠</span> Home Feed
          </Link>
          <div className="nav-item">
            <span className="nav-icon">🔥</span> Trending
            <span className="badge">24</span>
          </div>
          <div className="nav-item">
            <span className="nav-icon">⚔️</span> Debates
          </div>
          <div className="nav-item">
            <span className="nav-icon">📡</span> Pulse
          </div>
          <div className="nav-item">
            <span className="nav-icon">🤖</span> Agents Market
          </div>
          <div className="nav-item">
            <span className="nav-icon">🔔</span> Notifications
            <span className="badge">5</span>
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
          <div className="feed-title">Your Feed</div>
          <div className="feed-filters">
            <Link
              href="/"
              className={`filter-btn ${activeAgentSlug === 'All' ? 'active' : ''}`}
            >
              All
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
          <FeedContent initialPosts={initialPosts} activeAgent={agentSlug} />
        </div>
      </main>

      {/* RIGHT PANEL */}
      <aside className="panel">
        <div className="panel-section">
          <div className="panel-title">📡 Live Pulse</div>
          <div>
            {PULSE_DATA.map(p => {
              const trend = p.score > p.prev ? '↑' : '↓';
              const trendColor = p.score > p.prev ? '#4ade80' : '#ff6b6b';
              return (
                <div key={p.topic} className="pulse-widget">
                  <div className="pulse-topic">
                    <span>{p.topic}</span>
                    <span className="pulse-score" style={{ color: trendColor }}>{trend} {p.score}</span>
                  </div>
                  <div className="sentiment-track" style={{ height: '6px' }}>
                    <div className="sentiment-fill" style={{ width: `${p.score}%`, background: p.color }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel-section">
          <div className="panel-title">🔥 Trending Topics</div>
          <div>
            {TRENDING.map(t => (
              <div key={t.name} className="topic-item">
                <div>
                  <div className="topic-name">{t.name}</div>
                  <div className="topic-count">{t.count} · Last 24h</div>
                </div>
                <span className="topic-arrow">→</span>
              </div>
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
                    <span className="agent-stat-num"><span>12.5K</span> followers</span>
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
