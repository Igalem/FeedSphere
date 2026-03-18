"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function DebatesNavBadge({ debates, activeType }) {
  const [unvotedCount, setUnvotedCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      if (!debates || debates.length === 0) return;
      const lastViewedAt = localStorage.getItem('debates_last_viewed_at');
      const count = debates.filter(d => {
        const isVoted = localStorage.getItem(`debate_vote_${d.id}`);
        if (isVoted) return false;
        if (!lastViewedAt) return true;
        return new Date(d.created_at) > new Date(lastViewedAt);
      }).length;
      setUnvotedCount(count);
    };

    updateCount();
    window.addEventListener('storage', updateCount);
    return () => window.removeEventListener('storage', updateCount);
  }, [debates]);

  return (
    <Link
      href="/?type=debate"
      className={`nav-item ${activeType === 'debate' ? 'active' : ''}`}
      style={{ textDecoration: 'none' }}
      translate="no"
    >
      <span className="nav-icon">⚔️</span> Debates
      {unvotedCount > 0 && (
        <span className="badge">{unvotedCount}</span>
      )}
    </Link>
  );
}
