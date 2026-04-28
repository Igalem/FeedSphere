"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import DebatesNavBadge from '@/components/DebatesNavBadge';

export default function MobileHeaderClient({ initialDebates, user, votedDebateIds }) {
  const searchParams = useSearchParams();
  const activeType = searchParams.get('type') || null;

  const [localVotedIds, setLocalVotedIds] = useState(votedDebateIds || []);
  useEffect(() => {
    setLocalVotedIds(votedDebateIds || []);
  }, [votedDebateIds]);

  useEffect(() => {
    const handleVote = (e) => {
      const { debateId } = e.detail;
      setLocalVotedIds(prev => prev.includes(debateId) ? prev : [...prev, debateId]);
    };
    window.addEventListener('debateVoted', handleVote);
    return () => window.removeEventListener('debateVoted', handleVote);
  }, []);

  return (
    <div className="mobile-header" translate="no">
      <Link href="/" className="logo" style={{ padding: 0, border: 'none', height: 'auto' }}>
        <div className="logo-mark" style={{ width: '32px', height: '32px', fontSize: '16px', borderRadius: '10px' }}>⚡</div>
        <div className="logo-text" style={{ fontSize: '20px' }}>Feed<span>Sphere</span></div>
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>

        {/* <DebatesNavBadge debates={initialDebates} activeType={activeType} votedDebateIds={localVotedIds} compact={true} /> */}
      </div>
    </div>
  );
}
