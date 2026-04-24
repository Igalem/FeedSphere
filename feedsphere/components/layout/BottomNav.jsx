"use client";
import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import DraggableScrollContainer from '../DraggableScrollContainer';

export default function BottomNav({ user, agents = [], followedAgentIds = [] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isAgentsOpen, setIsAgentsOpen] = useState(false);

  const activeAgentSlug = searchParams.get('agent');
  const isHome = pathname === '/' && !activeAgentSlug;
  const isDiscover = pathname === '/discover';
  const isProfile = pathname === '/profile';
  const isLogin = pathname === '/login';
  const isAgentActive = activeAgentSlug || isAgentsOpen;

  const followedAgents = agents.filter(a => followedAgentIds.includes(a.id));

  const scrollToTop = () => {
    const feedEl = document.querySelector('.feed');
    if (feedEl) {
      feedEl.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const toggleAgents = (e) => {
    e.preventDefault();
    setIsAgentsOpen(!isAgentsOpen);
  };

  const handleDiscoverClick = (e) => {
    setIsAgentsOpen(false);
    scrollToTop();
    if (isDiscover) {
      e.preventDefault();
      router.push('/');
    }
  };

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  return (
    <nav className="mobile-bottom-nav-container" translate="no">
      {isAgentsOpen && followedAgents.length > 0 && (
        <div className="mobile-agents-bar">
          <DraggableScrollContainer className="mobile-agents-scroll">
            <Link
              href="/"
              onClick={() => { setIsAgentsOpen(false); scrollToTop(); }}
              className={`mobile-agent-item ${!activeAgentSlug ? 'active' : ''}`}
            >
              <div className="mobile-agent-avatar all-agents">🌐</div>
              <span className="mobile-agent-name">All</span>
            </Link>
            {followedAgents.map((agent) => (
              <Link
                key={agent.id}
                href={`/?agent=${agent.slug}`}
                onClick={() => { setIsAgentsOpen(false); scrollToTop(); }}
                className={`mobile-agent-item ${activeAgentSlug === agent.slug ? 'active' : ''}`}
              >
                <div
                  className="mobile-agent-avatar"
                  style={{ background: `${agent.color_hex}22`, border: activeAgentSlug === agent.slug ? `2px solid ${agent.color_hex}` : '1px solid var(--border)' }}
                >
                  {[...(agent.emoji || '')].slice(0, 3).join('')}
                </div>
                <span className="mobile-agent-name">{agent.name}</span>
              </Link>
            ))}
          </DraggableScrollContainer>
        </div>
      )}

      <div className="mobile-bottom-nav">
        <Link href="/" onClick={() => { setIsAgentsOpen(false); scrollToTop(); }} className={`mobile-nav-item ${isHome ? 'active' : ''}`}>
          <span className="mobile-nav-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </span>
          <span>Home</span>
        </Link>

        <a href="#" onClick={toggleAgents} className={`mobile-nav-item ${isAgentActive ? 'active' : ''}`}>
          <span className="mobile-nav-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <circle cx="12" cy="5" r="2" />
              <path d="M12 7v4" />
              <line x1="8" y1="16" x2="8" y2="16" />
              <line x1="16" y1="16" x2="16" y2="16" />
            </svg>
          </span>
          <span>Agents</span>
        </a>

        <Link href="/discover" onClick={handleDiscoverClick} className={`mobile-nav-item ${isDiscover ? 'active' : ''}`}>
          <span className="mobile-nav-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
          </span>
          <span>Discover</span>
        </Link>

        {user ? (
          <Link href="/profile" onClick={() => { setIsAgentsOpen(false); scrollToTop(); }} className={`mobile-nav-item ${isProfile ? 'active' : ''}`}>
            <div className="user-nav-avatar" style={{ width: '22px', height: '22px', fontSize: '10px' }}>
              {user.user_metadata?.full_name?.charAt(0) || user.email?.charAt(0) || '👤'}
            </div>
            <span>{userName}</span>
          </Link>
        ) : (
          <Link href="/login" onClick={() => { setIsAgentsOpen(false); scrollToTop(); }} className={`mobile-nav-item ${isLogin ? 'active' : ''}`}>
            <span className="mobile-nav-icon">🔑</span>
            <span>Sign In</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
