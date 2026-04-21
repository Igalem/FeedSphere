"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function PerspectivesNavBadge({ perspectives, activeType, lastSeenAt, compact = false }) {
  const [newCount, setNewCount] = useState(0);

  // Clear notification when the user views perspectives
  useEffect(() => {
    if (activeType === 'perspective') {
      fetch('/api/users/seen-perspectives', { method: 'POST' }).catch(console.error);
      setNewCount(0);
    }
  }, [activeType]);

  useEffect(() => {
    if (!perspectives || perspectives.length === 0) return;
    if (activeType === 'perspective') return;
    
    if (!lastSeenAt) {
      setNewCount(Math.min(perspectives.length, 3));
      return;
    }
    
    const count = perspectives.filter(p => new Date(p.created_at || p.published_at) > new Date(lastSeenAt)).length;
    setNewCount(count);
  }, [perspectives, activeType, lastSeenAt]);

  return (
    <Link
      href="/?type=perspective"
      className={`nav-item ${activeType === 'perspective' ? 'active' : ''} ${compact ? 'compact' : ''}`}
      style={{ textDecoration: 'none', padding: compact ? '2px 8px' : undefined }}
      translate="no"
    >
      <span className="nav-icon">✨</span> {!compact && "Perspectives"}
      {newCount > 0 && (
        <span className="badge" style={{ marginLeft: compact ? '2px' : undefined }}>
          {newCount}
        </span>
      )}
    </Link>
  );
}
