"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import DebatesNavBadge from '@/components/DebatesNavBadge';
import PerspectivesNavBadge from '@/components/PerspectivesNavBadge';

export default function MobileHeaderClient({ latestPerspectives, initialDebates, user, votedDebateIds, lastSeenPerspectivesAt }) {
  const searchParams = useSearchParams();
  const activeType = searchParams.get('type') || null;

  const [localVotedIds, setLocalVotedIds] = useState(votedDebateIds || []);
  const [localLastSeen, setLocalLastSeen] = useState(lastSeenPerspectivesAt);
  const [isHidden, setIsHidden] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    if (activeType === 'perspective') {
      setLocalLastSeen(new Date().toISOString());
    }
  }, [activeType]);

  useEffect(() => {
    setLocalVotedIds(votedDebateIds || []);
    setLocalLastSeen(lastSeenPerspectivesAt);
  }, [votedDebateIds, lastSeenPerspectivesAt]);

  useEffect(() => {
    const handleVote = (e) => {
      const { debateId } = e.detail;
      setLocalVotedIds(prev => prev.includes(debateId) ? prev : [...prev, debateId]);
    };
    window.addEventListener('debateVoted', handleVote);
    return () => window.removeEventListener('debateVoted', handleVote);
  }, []);

  useEffect(() => {
    const handleScroll = (e) => {
      // The feed container is what scrolls, not the window
      const container = e.target;
      if (!container) return;
      
      const currentScrollY = container.scrollTop;
      
      if (currentScrollY > lastScrollY && currentScrollY > 60) {
        setIsHidden(true);
      } else if (currentScrollY < lastScrollY) {
        setIsHidden(false);
      }
      setLastScrollY(currentScrollY);
    };

    const feedEl = document.querySelector('.feed');
    if (feedEl) {
      feedEl.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      if (feedEl) feedEl.removeEventListener('scroll', handleScroll);
    };
  }, [lastScrollY]);

  return (
    <div className={`mobile-header ${isHidden ? 'hide' : ''}`} translate="no">
      <Link href="/" className="logo" style={{ padding: 0, border: 'none', height: 'auto' }}>
        <div className="logo-mark" style={{ width: '28px', height: '28px', fontSize: '14px', borderRadius: '8px' }}>⚡</div>
        <div className="logo-text" style={{ fontSize: '16px' }}>Feed<span>Sphere</span></div>
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <PerspectivesNavBadge perspectives={latestPerspectives} activeType={activeType} lastSeenAt={localLastSeen} compact={true} />
        <DebatesNavBadge debates={initialDebates} activeType={activeType} votedDebateIds={localVotedIds} compact={true} />
      </div>
    </div>
  );
}
