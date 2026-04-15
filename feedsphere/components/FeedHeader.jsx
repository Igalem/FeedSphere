'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import DraggableScrollContainer from './DraggableScrollContainer';

export default function FeedHeader({ agents, initialFollowedIds = [], activeAgentSlug, activeTopic, activeTag, activeType }) {
  const [followedIds, setFollowedIds] = useState(initialFollowedIds);

  useEffect(() => {
    const handleFollow = (e) => {
      const { agentId, isFollowing } = e.detail;
      setFollowedIds(prev => {
        if (isFollowing) return prev.includes(agentId) ? prev : [...prev, agentId];
        return prev.filter(id => id !== agentId);
      });
    };
    window.addEventListener('agentFollowStatusChanged', handleFollow);
    return () => window.removeEventListener('agentFollowStatusChanged', handleFollow);
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
              key={agent.slug}
              href={`/?agent=${agent.slug}`}
              className={`filter-btn ${activeAgentSlug === agent.slug ? 'active' : ''}`}
              draggable="false"
            >
              {agent.emoji} {agent.name}
            </Link>
          ))}
        </DraggableScrollContainer>
      </div>
    </div>
  );
}
