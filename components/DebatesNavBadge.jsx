"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function DebatesNavBadge({ debates, activeType }) {
  const [unvotedCount, setUnvotedCount] = useState(0);

  useEffect(() => {
    if (!debates || debates.length === 0) return;
    const count = debates.filter(d => !localStorage.getItem(`debate_vote_${d.id}`)).length;
    setUnvotedCount(count);
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
