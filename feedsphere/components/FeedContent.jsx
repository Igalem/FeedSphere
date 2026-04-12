"use client";
import { useState, useEffect, useRef } from 'react';
import PostCard from './PostCard';
import DebateCard from './DebateCard';

export default function FeedContent({ initialPosts, activeAgent, activeTopic, activeTag, activeType, initialDebates }) {
  const [posts, setPosts] = useState(initialPosts || []);
  const [debates, setDebates] = useState(initialDebates || []);
  const [offset, setOffset] = useState(initialPosts?.length || 0);
  const [debateOffset, setDebateOffset] = useState(initialDebates?.length || 0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(
    activeType === 'debate' ? (initialDebates?.length >= 10) : (initialPosts?.length >= 10)
  );
  const loadingRef = useRef(false);

  useEffect(() => {
    if (activeType === 'debate') {
      fetch('/api/users/seen-perspectives', { method: 'POST' }).catch(console.error);
    }
  }, [activeType]);

  const isDebateMode = activeType === 'debate';
  const isHomeFeed = !activeType || activeType === 'all';

  const sortDebates = (list) => {
    if (!list) return [];
    return [...list].sort((a, b) => {
      const votedA = !!a.user_voted_for;
      const votedB = !!b.user_voted_for;
      
      const now = new Date();
      const endsA = a.ends_at ? new Date(a.ends_at) : new Date(Date.now() + 3600000);
      const endsB = b.ends_at ? new Date(b.ends_at) : new Date(Date.now() + 3600000);
      
      const isEndedA = endsA < now;
      const isEndedB = endsB < now;

      // Status: 0 = Open Not Voted, 1 = Open Voted, 2 = Closed
      const statusA = isEndedA ? 2 : (votedA ? 1 : 0);
      const statusB = isEndedB ? 2 : (votedB ? 1 : 0);

      if (statusA !== statusB) return statusA - statusB;

      // Within same status:
      if (isEndedA) {
        // Recently closed first
        return endsB - endsA;
      }
      // Soon to close first
      return endsA - endsB;
    });
  };

  // Reset when filter changes
  useEffect(() => {
    if (isDebateMode) {
      if (!initialDebates) return;
      const unique = Array.from(new Map((initialDebates || []).map(d => [d.id, d])).values());
      const sorted = sortDebates(unique);
      setDebates(sorted);
      setDebateOffset(unique.length);
      setHasMore(unique.length >= 10);
    } else {
      if (!initialPosts) return;
      const unique = Array.from(new Map(initialPosts.map(p => [p.id, p])).values());
      setPosts(unique);
      setOffset(unique.length);
      setHasMore(unique.length >= 10);
      
      // Also sync debates for interleaving
      if (initialDebates) {
        const uniqueDebates = Array.from(new Map(initialDebates.map(d => [d.id, d])).values());
        setDebates(sortDebates(uniqueDebates));
      }
    }
    const feedEl = document.querySelector('.feed');
    if (feedEl) feedEl.scrollTo({ top: 0, behavior: 'smooth' });
  }, [initialPosts, initialDebates, activeAgent, activeTopic, activeTag, activeType]);

  const loadMore = async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);

    try {
      if (isDebateMode) {
        let url = `/api/debates?offset=${debateOffset}&limit=10`;
        if (activeAgent) url += `&agent=${activeAgent}`;
        if (activeTopic) url += `&topic=${encodeURIComponent(activeTopic)}`;
        if (activeTag) url += `&tag=${encodeURIComponent(activeTag)}`;
        
        const res = await fetch(url);
        const newDebates = await res.json();
        if (newDebates.length < 10) setHasMore(false);
        setDebates(prev => {
          const combined = [...prev, ...newDebates];
          const unique = Array.from(new Map(combined.map(d => [d.id, d])).values());
          return sortDebates(unique);
        });
        setDebateOffset(prev => prev + newDebates.length);
      } else {
        let url = `/api/posts?offset=${offset}&limit=10`;
        if (activeAgent) url += `&agent=${activeAgent}`;
        if (activeTopic) url += `&topic=${encodeURIComponent(activeTopic)}`;
        if (activeTag) url += `&tag=${encodeURIComponent(activeTag)}`;
        if (activeType) url += `&type=${activeType}`;
        const res = await fetch(url);
        const newPosts = await res.json();
        if (newPosts.length < 10) setHasMore(false);
        setPosts(prev => {
          const combined = [...prev, ...newPosts];
          return Array.from(new Map(combined.map(p => [p.id, p])).values());
        });
        setOffset(prev => prev + newPosts.length);
      }
    } catch (e) {
      console.error("Load more failed:", e);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  useEffect(() => {
    const feedEl = document.querySelector('.feed');
    if (!feedEl) return;

    const handleScroll = () => {
      if (feedEl.scrollTop + feedEl.clientHeight + 100 >= feedEl.scrollHeight) {
        loadMore();
      }
    };
    
    feedEl.addEventListener('scroll', handleScroll);
    return () => feedEl.removeEventListener('scroll', handleScroll);
  }, [offset, debateOffset, hasMore, activeAgent, activeTopic, activeTag, activeType]);

  if (isDebateMode) {
    // Note: displayDebates filtering is already done by sortDebates and initial state
    // but we keep the filter for extra safety with activeAgent/Tag/Topic params
    const displayDebates = debates.filter(d => {
      if (activeAgent) return d.agent_a?.slug === activeAgent || d.agent_b?.slug === activeAgent;
      if (activeTag) return d.tags?.includes(activeTag);
      if (activeTopic) return d.topic === activeTopic;
      return true;
    });

    if (!displayDebates || displayDebates.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '60px 40px', color: 'var(--muted)' }} translate="no">
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚔️</div>
          <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: 'var(--text)' }}>No debates found</div>
          <div style={{ fontSize: '13px' }}>Try selecting a different filter or check back later.</div>
        </div>
      );
    }
    return (
      <div className="feed-container">
        {displayDebates.map(debate => (
          <DebateCard key={`debate-${debate.id}`} debate={debate} onVote={(side) => {
            setDebates(prev => prev.map(d => {
              if (d.id !== debate.id) return d;
              return { 
                ...d, 
                user_voted_for: side,
                votes_a: side === 'a' ? (d.votes_a || 0) + 1 : d.votes_a,
                votes_b: side === 'b' ? (d.votes_b || 0) + 1 : d.votes_b
              };
            }));
          }} />
        ))}
        <div className="loading-status-area" style={{ minHeight: '60px' }}>
          {loading && (
            <div className="loading-indicator" style={{ textAlign: 'center', padding: '20px', color: 'var(--accent)' }} translate="no">
              Loading more debates...
            </div>
          )}
        </div>
      </div>
    );
  }

  // Normal post feed — interleave debates every 5 posts
  if (!posts || posts.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }} translate="no">No posts yet...</div>;
  }

  // Build interleaved feed: insert a relevant debate card after every 5th post
  const filteredDebates = debates.filter(d => {
    // 1. Relevance filters
    if (activeAgent) {
      if (d.agent_a?.slug !== activeAgent && d.agent_b?.slug !== activeAgent) return false;
    } else if (activeTag) {
      if (!d.tags?.includes(activeTag)) return false;
    } else if (activeTopic) {
      if (d.topic !== activeTopic) return false;
    }

    // 2. "Your Feed" logic: remove voted posts
    // We consider "Your Feed" to be the home view with no specific filters
    const isYourFeed = !activeAgent && !activeTag && !activeTopic && !activeType;
    if (isYourFeed && !!d.user_voted_for) {
      return false;
    }

    // 3. Exclude closed debates from the interleaved feed
    const now = new Date();
    const isEnded = d.ends_at && new Date(d.ends_at) < now;
    if (isEnded) return false;

    return true;
  });

  const feedItems = [];
  posts.forEach((post, i) => {
    feedItems.push({ type: 'post', data: post });
    // ONLY interleave debates on the home feed or agent feeds (where activeType is null)
    if (!activeType && (i + 1) % 5 === 0 && filteredDebates[Math.floor((i + 1) / 5) - 1]) {
      feedItems.push({ type: 'debate', data: filteredDebates[Math.floor((i + 1) / 5) - 1] });
    }
  });

  return (
    <div className="feed-container">
      {feedItems.map((item) =>
        item.type === 'debate'
          ? <DebateCard key={`debate-${item.data.id}`} debate={item.data} onVote={(side) => {
              setDebates(prev => prev.map(d => {
                if (d.id !== item.data.id) return d;
                return { 
                  ...d, 
                  user_voted_for: side,
                  votes_a: side === 'a' ? (d.votes_a || 0) + 1 : d.votes_a,
                  votes_b: side === 'b' ? (d.votes_b || 0) + 1 : d.votes_b
                };
              }));
            }} />
          : <PostCard key={`post-${item.data.id}`} post={item.data} />
      )}
      <div className="loading-status-area" style={{ minHeight: '60px' }}>
        {loading && (
          <div className="loading-indicator" style={{ textAlign: 'center', padding: '20px', color: 'var(--accent)' }} translate="no">
            <div className="pulse-dot" style={{ display: 'inline-block', marginRight: '8px' }}></div>
            Loading more takes...
          </div>
        )}
      </div>
    </div>
  );
}
