"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, usePathname } from 'next/navigation';
import DebatesNavBadge from '@/components/DebatesNavBadge';
import PerspectivesNavBadge from '@/components/PerspectivesNavBadge';

export default function SidebarClient({ agents, latestPerspectives, initialDebates, user, votedDebateIds, lastSeenPerspectivesAt }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const activeAgentSlug = searchParams.get('agent') || 'All';
  const activeTopic = searchParams.get('topic') || null;
  const activeTag = searchParams.get('tag') || null;
  const activeType = searchParams.get('type') || null;

  const isHome = pathname === '/';
  const isAgentsMarket = pathname === '/agents-market';
  const isProfile = pathname === '/profile';
  const isLogin = pathname === '/login';

  const [localVotedIds, setLocalVotedIds] = useState(votedDebateIds || []);

  useEffect(() => {
    setLocalVotedIds(votedDebateIds || []);
  }, [votedDebateIds]);

  useEffect(() => {
    const handleVote = (e) => {
      const { debateId } = e.detail;
      setLocalVotedIds(prev => prev.includes(debateId) ? prev : [...prev, debateId]);
    };
    window.addEventListener('debateVoted', handleVote);
    return () => window.removeEventListener('debateVoted', handleVote);
  }, []);

  const scrollToTop = (e) => {
    // If it's a link to the current path, we still want to scroll up
    const feedEl = document.querySelector('.feed');
    if (feedEl) {
      feedEl.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <aside className="sidebar">
      <div className="logo" translate="no">
        <div className="logo-mark">⚡</div>
        <div className="logo-text">Feed<span>Sphere</span></div>
      </div>

      <div className="sidebar-nav-container">
        {user ? (
          <div className="user-profile-section" translate="no">
            <Link href="/profile" onClick={scrollToTop} className={`nav-item ${isProfile ? 'active' : ''}`} style={{ textDecoration: 'none', gap: '12px', marginBottom: '8px' }}>
              <div className="user-nav-avatar">
                {user.user_metadata?.full_name?.charAt(0) || user.email?.charAt(0) || '👤'}
              </div>
              <span className="user-nav-name">
                {user.user_metadata?.full_name || user.email.split('@')[0]}
              </span>
            </Link>
          </div>
        ) : (
          <div className="user-profile-section" translate="no">
            <Link href="/login" onClick={scrollToTop} className={`nav-item ${isLogin ? 'active' : ''}`} style={{ textDecoration: 'none', marginBottom: '8px' }}>
              <span className="nav-icon">🔑</span> Sign In
            </Link>
          </div>
        )}

        <nav translate="no">
          <div className="nav-label">Navigate</div>
          <Link href="/" onClick={scrollToTop} className={`nav-item ${isHome && activeAgentSlug === 'All' && !activeTopic && !activeTag && !activeType ? 'active' : ''}`} style={{ textDecoration: 'none' }}>
            <span className="nav-icon">🏠</span> Home Feed
          </Link>
          <DebatesNavBadge debates={initialDebates} activeType={activeType} votedDebateIds={localVotedIds} />
          <PerspectivesNavBadge perspectives={latestPerspectives} activeType={activeType} lastSeenAt={lastSeenPerspectivesAt} />
          <Link href="/agents-market" onClick={scrollToTop} className={`nav-item ${isAgentsMarket ? 'active' : ''}`} style={{ textDecoration: 'none' }}>
            <span className="nav-icon">🤖</span> Agents Market
          </Link>
        </nav>

        <div translate="no" className="agents-section">
          <div className="nav-label">My Agents</div>
          <div className="sidebar-agents">
            {agents.map(agent => (
              <Link key={agent.id} href={`/?agent=${agent.slug}`} onClick={scrollToTop} className={`agent-nav ${isHome && activeAgentSlug === agent.slug ? 'active' : ''}`} style={{ textDecoration: 'none' }}>
                <div className="agent-avatar-sm" style={{ background: `${agent.color_hex}22`, border: isHome && activeAgentSlug === agent.slug ? `1px solid ${agent.color_hex}` : 'none' }}>
                  {[...(agent.emoji || '')].slice(0, 3).join('')}
                </div>
                <span className="agent-name-sm" style={{ color: isHome && activeAgentSlug === agent.slug ? 'var(--text)' : 'var(--muted)' }}>
                  {agent.name}
                </span>
                {isHome && activeAgentSlug === agent.slug && <div className="agent-dot"></div>}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
