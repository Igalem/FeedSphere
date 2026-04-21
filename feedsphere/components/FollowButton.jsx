'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function FollowButton({ agentId, creatorId, initialFollowerCount = 0, initialIsFollowing = null, className = '', hideCount = false }) {
  const [user, setUser] = useState(null);
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing === null ? false : initialIsFollowing);
  const [isLoading, setIsLoading] = useState(initialIsFollowing === null);
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  const [supabase] = useState(() => createClient());

  const isCreator = user && creatorId && user.id === creatorId;

  const formatFollowers = (count) => {
    if (count == null) return '0';
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      const currentUser = data.user;

      if (currentUser && creatorId && currentUser.id === creatorId) {
        setIsFollowing(true);
        setIsLoading(false);
      } else if (currentUser && initialIsFollowing === null) {
        setIsLoading(true);
        fetch(`/api/agents/${agentId}/follow`)
          .then(res => res.json())
          .then(data => setIsFollowing(data.isFollowing))
          .finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    const handleExternalUpdate = (e) => {
      if (e.detail.agentId === agentId) {
        setIsFollowing(e.detail.isFollowing);
      }
    };
    window.addEventListener('agentFollowStatusChanged', handleExternalUpdate);
    return () => window.removeEventListener('agentFollowStatusChanged', handleExternalUpdate);
  }, [supabase, agentId, initialIsFollowing, creatorId]);

  const handleToggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      alert("Please sign in to follow agents.");
      return;
    }

    if (isCreator) return;
    if (isLoading) return;

    const prevFollowing = isFollowing;
    const action = isFollowing ? 'unfollow' : 'follow';
    
    setIsFollowing(!prevFollowing);
    setFollowerCount(prev => action === 'follow' ? prev + 1 : Math.max(0, prev - 1));
    
    try {
      const res = await fetch(`/api/agents/${agentId}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      // Dispatch event for cross-component sync
      window.dispatchEvent(new CustomEvent('agentFollowStatusChanged', {
        detail: { agentId, isFollowing: action === 'follow' }
      }));
      
    } catch (err) {
      console.error('Follow toggle failed:', err);
      setIsFollowing(prevFollowing);
      setFollowerCount(prev => action === 'follow' ? prev - 1 : prev + 1);
      if (err.message) alert(err.message);
    }
  };

  return (
    <div className={`flex flex-col items-end shrink-0 ${hideCount ? 'justify-center' : ''}`}>
      {!hideCount && <p className="text-[12px] text-gray-500 mb-1">{formatFollowers(followerCount)} followers</p>}
      <button 
        onClick={handleToggle}
        disabled={isLoading || isCreator}
        className={`follow-btn flex-shrink-0 !px-5 !py-1 !text-[13px] font-semibold ${isFollowing ? 'following bg-gray-700' : ''} ${isCreator ? 'opacity-80 cursor-default' : ''} ${className}`}
        translate="no"
        title={isCreator ? "You are the creator of this agent" : ""}
      >
        {isCreator ? 'Your Agent' : (isFollowing ? 'Following' : 'Follow')}
      </button>
    </div>
  );
}

