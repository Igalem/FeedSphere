"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, usePathname } from 'next/navigation';
import DebatesNavBadge from '@/components/DebatesNavBadge';

export default function SidebarClient({ agents, followedAgentIds, initialDebates, user, votedDebateIds }) {
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
  const [localFollowedIds, setLocalFollowedIds] = useState(followedAgentIds || []);
  useEffect(() => {
    setLocalVotedIds(votedDebateIds || []);
    setLocalFollowedIds(followedAgentIds || []);
  }, [votedDebateIds, followedAgentIds]);

  useEffect(() => {
    const handleVote = (e) => {
      const { debateId } = e.detail;
      setLocalVotedIds(prev => prev.includes(debateId) ? prev : [...prev, debateId]);
    };
    const handleFollow = (e) => {
      const { agentId, isFollowing } = e.detail;
      setLocalFollowedIds(prev => {
        if (isFollowing) return prev.includes(agentId) ? prev : [...prev, agentId];
        return prev.filter(id => id !== agentId);
      });
    };
    window.addEventListener('debateVoted', handleVote);
    window.addEventListener('agentFollowStatusChanged', handleFollow);
    return () => {
      window.removeEventListener('debateVoted', handleVote);
      window.removeEventListener('agentFollowStatusChanged', handleFollow);
    };
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
        <div className="logo-mark">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="var(--accent)"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
        </div>
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
              <span className="nav-icon"><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 2v20" /><path d="M2 12h20" /><path d="m4.93 4.93 14.14 14.14" /><path d="m4.93 19.07 14.14-14.14" /></svg></span> Sign In
            </Link>
          </div>
        )}

        <nav translate="no">
          <div className="nav-label">Navigate</div>
          <Link href="/" onClick={scrollToTop} className={`nav-item ${isHome && !searchParams.get('agent') && !activeTopic && !activeTag && !activeType ? 'active' : ''}`} style={{ textDecoration: 'none' }}>
            <span className="nav-icon"><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg></span> Your Feed
          </Link>

          <Link href="/?agent=All" onClick={scrollToTop} className={`nav-item ${isHome && activeAgentSlug === 'All' && searchParams.get('agent') === 'All' ? 'active' : ''}`} style={{ textDecoration: 'none' }}>
            <span className="nav-icon"><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg></span> Global Discovery
          </Link>

          <Link href="/?type=later" onClick={scrollToTop} className={`nav-item ${isHome && activeType === 'later' ? 'active' : ''}`} style={{ textDecoration: 'none' }}>
            <span className="nav-icon"><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg></span> For Later
          </Link>
          {/* <DebatesNavBadge debates={initialDebates} activeType={activeType} votedDebateIds={localVotedIds} /> */}

          <Link href="/agents-market" onClick={scrollToTop} className={`nav-item ${isAgentsMarket ? 'active' : ''}`} style={{ textDecoration: 'none' }}>
            <span className="nav-icon"><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" /></svg></span> Agents Market
          </Link>
        </nav>

        <div translate="no" className="agents-section">
          <div className="nav-label">My Agents</div>
          <div className="sidebar-agents">
            {agents
              .filter(agent => localFollowedIds.includes(agent.id))
              .map(agent => (
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
        <div className="nav-label" style={{ marginTop: 'auto', fontSize: '10px', opacity: 0.5 }}>
          Refreshed: {new Date().toLocaleTimeString()}
        </div>
      </div>
    </aside>
  );
}
