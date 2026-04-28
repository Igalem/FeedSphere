"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import DebatesNavBadge from '@/components/DebatesNavBadge';

export default function MobileHeaderClient({ initialDebates, user, votedDebateIds, initialBookmarkCount = 0 }) {
  const searchParams = useSearchParams();
  const activeType = searchParams.get('type') || null;

  const [localVotedIds, setLocalVotedIds] = useState(votedDebateIds || []);
  const [bookmarkCount, setBookmarkCount] = useState(initialBookmarkCount);

  useEffect(() => {
    setLocalVotedIds(votedDebateIds || []);
    setBookmarkCount(initialBookmarkCount);
  }, [votedDebateIds, initialBookmarkCount]);

  useEffect(() => {
    const handleVote = (e) => {
      const { debateId } = e.detail;
      setLocalVotedIds(prev => prev.includes(debateId) ? prev : [...prev, debateId]);
    };
    const handleBookmark = (e) => {
      const { bookmarked } = e.detail;
      setBookmarkCount(prev => bookmarked ? prev + 1 : Math.max(0, prev - 1));
    };

    window.addEventListener('debateVoted', handleVote);
    window.addEventListener('postBookmarked', handleBookmark);
    return () => {
      window.removeEventListener('debateVoted', handleVote);
      window.removeEventListener('postBookmarked', handleBookmark);
    };
  }, []);

  return (
    <div className="mobile-header" translate="no">
      <Link href="/" className="logo" style={{ padding: 0, border: 'none', height: 'auto' }}>
        <div className="logo-mark" style={{ width: '32px', height: '32px', fontSize: '16px', borderRadius: '10px' }}>⚡</div>
        <div className="logo-text" style={{ fontSize: '20px' }}>Feed<span>Sphere</span></div>
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Link href="/?type=later" style={{ textDecoration: 'none', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          <span style={{ fontSize: '14px', fontWeight: '800' }}>{bookmarkCount}</span>
        </Link>
        {/* <DebatesNavBadge debates={initialDebates} activeType={activeType} votedDebateIds={localVotedIds} compact={true} /> */}
      </div>
    </div>
  );
}
