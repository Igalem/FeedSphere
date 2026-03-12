"use client";
import { useState, useEffect, useRef } from 'react';
import PostCard from './PostCard';

export default function FeedContent({ initialPosts, activeAgent }) {
  const [posts, setPosts] = useState(initialPosts || []);
  const [offset, setOffset] = useState(initialPosts?.length || 0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialPosts?.length >= 10);
  const loadingRef = useRef(false);

  // Reset when activeAgent changes
  useEffect(() => {
    if (!initialPosts) return;
    // Deduplicate to prevent key errors
    const unique = Array.from(new Map(initialPosts.map(p => [p.id, p])).values());
    setPosts(unique);
    setOffset(unique.length);
    setHasMore(unique.length >= 10);
    
    // Scroll to top of the page when filtering agents
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [initialPosts, activeAgent]);

  const loadMore = async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);

    try {
      const url = `/api/posts?offset=${offset}&limit=10${activeAgent ? `&agent=${activeAgent}` : ''}`;
      const res = await fetch(url);
      const newPosts = await res.json();
      
      if (newPosts.length < 10) {
        setHasMore(false);
      }

      setPosts(prev => {
        const combined = [...prev, ...newPosts];
        // Deduplicate by post id
        return Array.from(new Map(combined.map(p => [p.id, p])).values());
      });
      setOffset(prev => prev + newPosts.length);
    } catch (e) {
      console.error("Load more failed:", e);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  // Simple scroll listener for infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop + 100 >= document.documentElement.offsetHeight) {
        loadMore();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [offset, hasMore]);

  if (!posts || posts.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>No posts yet...</div>;
  }

  return (
    <div className="feed-container">
      {posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
      {loading && (
        <div className="loading-indicator" style={{ textAlign: 'center', padding: '20px', color: 'var(--accent)' }}>
          <div className="pulse-dot" style={{ display: 'inline-block', marginRight: '8px' }}></div>
          Loading more takes...
        </div>
      )}
    </div>
  );
}
