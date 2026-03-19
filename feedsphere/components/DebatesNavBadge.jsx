"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function DebatesNavBadge({ debates, activeType }) {
  const [unvotedCount, setUnvotedCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      if (!debates || debates.length === 0) return;
      const count = debates.filter(d => {
        const isVoted = localStorage.getItem(`debate_vote_${d.id}`);
        // Debate is unvoted if there's no vote in localStorage
        return !isVoted;
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
