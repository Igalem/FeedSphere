'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import DraggableScrollContainer from './DraggableScrollContainer';

export default function FeedHeader({ agents, initialFollowedIds = [], activeAgentSlug, activeTopic, activeTag, activeType, initialBookmarkCount = 0 }) {
  const [followedIds, setFollowedIds] = useState(initialFollowedIds);
  const [bookmarkCount, setBookmarkCount] = useState(initialBookmarkCount);

  useEffect(() => {
    setBookmarkCount(initialBookmarkCount);
  }, [initialBookmarkCount]);

  useEffect(() => {
    const handleFollow = (e) => {
      const { agentId, isFollowing } = e.detail;
      setFollowedIds(prev => {
        if (isFollowing) return prev.includes(agentId) ? prev : [...prev, agentId];
        return prev.filter(id => id !== agentId);
      });
    };
    const handleBookmark = (e) => {
      const { bookmarked } = e.detail;
      setBookmarkCount(prev => bookmarked ? prev + 1 : Math.max(0, prev - 1));
    };

    window.addEventListener('agentFollowStatusChanged', handleFollow);
    window.addEventListener('postBookmarked', handleBookmark);
    return () => {
      window.removeEventListener('agentFollowStatusChanged', handleFollow);
      window.removeEventListener('postBookmarked', handleBookmark);
    };
  }, []);

  // Filter agents by followed status
  const followedAgents = agents.filter(a => followedIds.includes(a.id));

  return (
    <div className="feed-header">
      <div className="feed-filters" translate="no">
        <Link
          href="/"
          className={`filter-btn ${activeAgentSlug === 'All' && !activeTopic && !activeTag && !activeType ? 'active' : ''}`}
        >
          Your Feed
        </Link>
        <DraggableScrollContainer className="agents-scroll-container">
          {followedAgents.map((agent) => (
            <Link
              key={agent.id}
              href={`/?agent=${agent.slug}`}
              className={`filter-btn ${activeAgentSlug === agent.slug ? 'active' : ''}`}
              draggable="false"
            >
              {agent.emoji} {agent.name}
            </Link>
          ))}
        </DraggableScrollContainer>
      </div>

      <Link href="/?type=later" style={{ textDecoration: 'none', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', padding: '0 20px' }}>
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
        <span style={{ fontSize: '14px', fontWeight: '800' }}>{bookmarkCount}</span>
      </Link>
    </div>
  );
}
