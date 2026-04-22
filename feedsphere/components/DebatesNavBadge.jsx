"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function DebatesNavBadge({ debates, activeType, votedDebateIds = [], compact = false }) {
  const [unvotedCount, setUnvotedCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      if (!debates || debates.length === 0) {
        setUnvotedCount(0);
        return;
      }
      const now = new Date();
      const count = debates.filter(d => {
        const isVoted = (votedDebateIds || []).includes(d.id);
        // Add a 5-second buffer to isActive to be safe with clock skews
        const isActive = !d.ends_at || new Date(d.ends_at).getTime() > (now.getTime() - 5000);
        return !isVoted && isActive;
      }).length;
      setUnvotedCount(count);
    };

    updateCount();
    const interval = setInterval(updateCount, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [debates, votedDebateIds]);

  return (
    <Link
      href="/?type=debate"
      className={`nav-item ${activeType === 'debate' ? 'active' : ''} ${compact ? 'compact' : ''}`}
      style={{ textDecoration: 'none', padding: compact ? '4px 8px' : undefined }}
      translate="no"
    >
      <span className="nav-icon">⚔️</span> {!compact && "Debates"}
      {unvotedCount > 0 && (
        <span className="badge" style={{ marginLeft: compact ? '2px' : undefined }}>{unvotedCount}</span>
      )}
    </Link>
  );
}
