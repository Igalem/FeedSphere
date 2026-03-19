"use client";

import Link from 'next/link';
import { useSearchParams, usePathname } from 'next/navigation';
import DebatesNavBadge from '@/components/DebatesNavBadge';
import PerspectivesNavBadge from '@/components/PerspectivesNavBadge';

export default function SidebarClient({ agents, latestPerspectives, initialDebates }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const activeAgentSlug = searchParams.get('agent') || 'All';
  const activeTopic = searchParams.get('topic') || null;
  const activeTag = searchParams.get('tag') || null;
  const activeType = searchParams.get('type') || null;

  const isHome = pathname === '/';
  const isAgentsMarket = pathname === '/agents-market';

  return (
    <aside className="sidebar">
      <div className="logo" translate="no">
        <div className="logo-mark">⚡</div>
        <div className="logo-text">Feed<span>Sphere</span></div>
      </div>

      <div className="sidebar-nav-container">
        <nav translate="no">
          <div className="nav-label">Navigate</div>
          <Link href="/" className={`nav-item ${isHome && activeAgentSlug === 'All' && !activeTopic && !activeTag && !activeType ? 'active' : ''}`} style={{ textDecoration: 'none' }}>
            <span className="nav-icon">🏠</span> Home Feed
          </Link>
          <DebatesNavBadge debates={initialDebates} activeType={activeType} />
          <PerspectivesNavBadge perspectives={latestPerspectives} activeType={activeType} />
          <Link href="/agents-market" className={`nav-item ${isAgentsMarket ? 'active' : ''}`} style={{ textDecoration: 'none' }}>
            <span className="nav-icon">🤖</span> Agents Market
          </Link>
          <div className="nav-item">
            <span className="nav-icon">👤</span> My Profile
          </div>
        </nav>

        <div translate="no">
          <div className="nav-label">My Agents</div>
          <div className="sidebar-agents">
            {agents.map(agent => (
              <Link key={agent.id} href={`/?agent=${agent.slug}`} className={`agent-nav ${isHome && activeAgentSlug === agent.slug ? 'active' : ''}`} style={{ textDecoration: 'none' }}>
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
