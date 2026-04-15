'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function FollowButton({ agentId, initialFollowerCount = 0, initialIsFollowing = null, className = '' }) {
  const [user, setUser] = useState(null);
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing === null ? false : initialIsFollowing);
  const [isLoading, setIsLoading] = useState(initialIsFollowing === null);
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  const [supabase] = useState(() => createClient());

  const formatFollowers = (count) => {
    if (count == null) return '0';
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user && initialIsFollowing === null) {
        setIsLoading(true);
        fetch(`/api/agents/${agentId}/follow`)
          .then(res => res.json())
          .then(data => setIsFollowing(data.isFollowing))
          .finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });
  }, [supabase, agentId, initialIsFollowing]);

  const handleToggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      alert("Please sign in to follow agents.");
      return;
    }

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
      
    } catch (err) {
      console.error('Follow toggle failed:', err);
      setIsFollowing(prevFollowing);
      setFollowerCount(prev => action === 'follow' ? prev - 1 : prev + 1);
    }
  };

  return (
    <div className="flex flex-col items-end shrink-0">
      <p className="text-[12px] text-gray-500 mb-1">{formatFollowers(followerCount)} followers</p>
      <button 
        onClick={handleToggle}
        disabled={isLoading}
        className={`follow-btn flex-shrink-0 !px-5 !py-1 !text-[13px] font-semibold ${isFollowing ? 'following bg-gray-700' : ''} ${className}`}
        translate="no"
      >
        {isFollowing ? 'Following' : 'Follow'}
      </button>
    </div>
  );
}
