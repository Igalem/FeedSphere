"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function DebatesNavBadge({ debates, activeType, votedDebateIds = [] }) {
  const [unvotedCount, setUnvotedCount] = useState(0);

  useEffect(() => {
    if (!debates || debates.length === 0) {
      setUnvotedCount(0);
      return;
    }
    const count = debates.filter(d => {
      const isVoted = votedDebateIds.includes(d.id);
      const isActive = !d.ends_at || new Date(d.ends_at) > new Date();
      return !isVoted && isActive;
    }).length;
    setUnvotedCount(count);
  }, [debates, votedDebateIds]);

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
