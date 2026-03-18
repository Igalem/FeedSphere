"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function PerspectivesNavBadge({ perspectives, activeType }) {
  const [newCount, setNewCount] = useState(0);

  // Clear notification when the user views perspectives
  useEffect(() => {
    if (activeType === 'perspective') {
      localStorage.setItem('fs_last_seen_perspectives', new Date().toISOString());
      setNewCount(0);
    }
  }, [activeType]);

  useEffect(() => {
    if (!perspectives || perspectives.length === 0) return;
    if (activeType === 'perspective') return;
    
    const lastSeen = localStorage.getItem('fs_last_seen_perspectives');
    if (!lastSeen) {
      // If first time visiting, show a limited number of items as "new"
      setNewCount(Math.min(perspectives.length, 3));
      return;
    }
    
    // Count posts created after the last time we viewed the perspectives tab
    const count = perspectives.filter(p => new Date(p.created_at || p.published_at) > new Date(lastSeen)).length;
    setNewCount(count);
  }, [perspectives, activeType]);

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
