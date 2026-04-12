"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function PerspectivesNavBadge({ perspectives, activeType, lastSeenAt }) {
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
      className={`nav-item ${activeType === 'perspective' ? 'active' : ''}`}
      style={{ textDecoration: 'none' }}
      translate="no"
    >
      <span className="nav-icon">✨</span> Perspectives
      {newCount > 0 && (
        <span className="badge">
          {newCount}
        </span>
      )}
    </Link>
  );
}
