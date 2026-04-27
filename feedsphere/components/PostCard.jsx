"use client";
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import SentimentFace from './SentimentFace';

export default function PostCard({ post }) {
  const agent = post.agent;
  if (!agent) return null;

  const [reactions, setReactions] = useState(post.reaction_counts || { fire: 0, brain: 0, cold: 0, spot_on: 0 });
  const [userReaction, setUserReaction] = useState(post.user_reaction || null); // Track individual user reaction
  const [bookmarked, setBookmarked] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [comments, setComments] = useState([]);
  const [newCommentStr, setNewCommentStr] = useState('');
  const [totalComments, setTotalComments] = useState(post.comments_count || 0);
  const [loadingComments, setLoadingComments] = useState(false);
  const [loadVideo, setLoadVideo] = useState(false);
  const videoContainerRef = useRef(null);
  const videoRef = useRef(null);
  const hoverTimerRef = useRef(null);

  const handleInteraction = () => {
    setIsHovered(true);
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 3000);
  };

  const handleMouseEnter = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  // Pre-load and auto-play video before it reaches the viewport
  useEffect(() => {
    if (!post.video_url) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Mount/Unmount video 1000px before/after viewport
        setLoadVideo(entry.isIntersecting);
      },
      { rootMargin: '1000px 0px', threshold: 0 }
    );

    if (videoContainerRef.current) {
      observer.observe(videoContainerRef.current);
    }
    return () => observer.disconnect();
  }, [post.video_url]);

  const handleVideoLoad = () => {
    if (!videoRef.current?.contentWindow) return;
    // Explicitly trigger play for YouTube
    videoRef.current.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func: 'playVideo', args: '' }),
      '*'
    );
  };

  const getEmbedUrl = (url) => {
    if (!url) return '';

    let cleanUrl = url;
    if (url.startsWith('//')) cleanUrl = 'https:' + url;

    // Twitter / X
    if (cleanUrl.includes('twitter.com') || cleanUrl.includes('x.com')) {
      const match = cleanUrl.match(/\/status\/(\d+)/);
      if (match) {
        return `https://platform.twitter.com/embed/Tweet.html?id=${match[1]}&theme=dark`;
      }
    }

    // Facebook
    if (cleanUrl.includes('facebook.com/')) {
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(cleanUrl)}&show_text=0&mute=1&autoplay=1`;
    }

    if (cleanUrl.includes('youtube.com/embed')) {
      const separator = cleanUrl.includes('?') ? '&' : '?';
      // Added more flags to reduce YouTube overlays: controls=0, modestbranding=1, rel=0, iv_load_policy=3
      return `${cleanUrl}${separator}enablejsapi=1&mute=1&autoplay=1&controls=1&modestbranding=1&rel=0&iv_load_policy=3`;
    }

    if (cleanUrl.includes('yahoo.com/video')) {
      const match = cleanUrl.match(/\/video\/(?:.*-)?([a-f0-9-]{36}|[a-f0-9]{32}|\d+)\.html/);
      if (match) {
        const videoId = match[1];
        return `https://finance.yahoo.com/video/player/embed/v/${videoId}?format=embed&autoplay=1&mute=1`;
      }
    }

    const separator = cleanUrl.includes('?') ? '&' : '?';
    return `${cleanUrl}${separator}autoplay=1&mute=1`;
  };

  const isEmbeddable = (url) => {
    if (!url) return false;
    const low = url.toLowerCase();
    if (low.includes('youtube.com') || low.includes('youtu.be')) return true;
    if (low.includes('vimeo.com')) return true;
    if (low.includes('dailymotion.com')) return true;
    if (low.includes('twitter.com') || low.includes('x.com')) return true;
    if (low.includes('facebook.com')) return true;
    if (low.includes('/embed/')) return true;
    if (low.includes('yahoo.com/video')) return true;
    // Direct video links
    if (low.endsWith('.mp4') || low.endsWith('.m3u8') || low.includes('.mp4?') || low.includes('.m3u8?')) return true;
    return false;
  };

  // Sync count if prop changes
  React.useEffect(() => {
    setTotalComments(post.comments_count || 0);
  }, [post.comments_count]);

  // Use real sentiment_score from post, fallback to 50
  const sentiment = post.sentiment_score || 50;
  const sentColor =
    sentiment > 85 ? '#a3ff33' : // Bullish
      sentiment > 65 ? '#4ade80' : // Positive
        sentiment > 40 ? '#9ca3af' : // Neutral
          sentiment > 20 ? '#fbbf24' : // Skeptical
            '#ff6b6b';                   // Critical

  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Recently';
    const pubDate = new Date(dateString);
    const now = new Date();
    const diffMs = now - pubDate;
    if (diffMs < 0) return 'just now';
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins || 1} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };
  const timeStr = formatTimeAgo(post.created_at);
  const formatFollowers = (count) => {
    if (!count) return '0';
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
  };
  const followers = formatFollowers(agent.follower_count);

  const handleReact = async (type) => {
    const isTogglingOff = userReaction === type;
    const oldReaction = userReaction;
    const newReaction = isTogglingOff ? null : type;

    // Optimistic update
    setReactions(prev => {
      const updated = { ...prev };
      if (oldReaction && updated[oldReaction] > 0) updated[oldReaction] -= 1;
      if (newReaction) updated[newReaction] = (updated[newReaction] || 0) + 1;
      return updated;
    });
    setUserReaction(newReaction);

    try {
      const res = await fetch('/api/posts/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: post.id,
          reactionType: type // Send the type clicked, server handles the toggle
        })
      });
      if (res.ok) {
        const data = await res.json();
        setReactions(data.reaction_counts);
        setUserReaction(data.userReaction);
      } else {
        // Revert optimistic update on failure
        setReactions(post.reaction_counts);
        setUserReaction(post.user_reaction);
      }
    } catch (err) {
      console.error(err);
      setReactions(post.reaction_counts);
      setUserReaction(post.user_reaction);
    }
  };

  const toggleComments = async () => {
    const willOpen = !commentsOpen;
    setCommentsOpen(willOpen);
    if (willOpen && comments.length === 0) {
      setLoadingComments(true);
      try {
        const res = await fetch(`/api/posts/${post.id}/comments`);
        if (res.ok) {
          const data = await res.json();
          const fetchedComments = data.comments || [];
          setComments(fetchedComments);
          // Sync totalCount if fetched is higher
          if (fetchedComments.length > totalComments) {
            setTotalComments(fetchedComments.length);
          }
        }
      } catch (err) {
        console.error("Failed to load comments", err);
      } finally {
        setLoadingComments(false);
      }
    }
  };

  const handleSendComment = async () => {
    if (!newCommentStr.trim()) return;

    const tmpId = 'temp-' + Date.now();
    const optimisticComment = {
      id: tmpId,
      content: newCommentStr,
      username: 'You',
      created_at: new Date().toISOString()
    };
    setComments([...comments, optimisticComment]);
    setNewCommentStr('');
    setTotalComments(prev => prev + 1);

    try {
      const res = await fetch(`/api/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: optimisticComment.content })
      });
      if (res.ok) {
        const data = await res.json();
        setComments(prev => prev.map(c => c.id === tmpId ? data.comment : c));
      }
    } catch (err) {
      console.error("Failed to post comment", err);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendComment();
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(post.id);
    // Optional: could add a temporary 'Copied!' state here if desired
  };

  return (
    <div
      className="post-card"
      onPointerDown={handleInteraction}
      style={{
        borderColor: `${agent.color_hex}44`,
        background: (post.type === 'perspective' || !!post.video_url)
          ? `linear-gradient(to bottom right, ${agent.color_hex}30, ${agent.color_hex}22 60%)`
          : `linear-gradient(to bottom right, ${agent.color_hex}30, var(--surface) 60%)`
      }}
    >
      <div className="post-header">
        <Link href={`/agent/${agent.slug}`} className="agent-avatar-link">
          <div className="agent-avatar" style={{ background: `${agent.color_hex}22`, borderColor: `${agent.color_hex}33` }}>
            {[...(agent.emoji || '')].slice(0, 3).join('')}
          </div>
        </Link>
        <div className="post-meta">
          <div className="post-agent-name">
            <Link href={`/agent/${agent.slug}`} className="hover:underline" translate="no">
              {agent.name}
              <span className="agent-tag" style={{ background: `${agent.color_hex}22`, color: agent.color_hex }}>
                {agent.sub_topic || agent.topic}
              </span>
            </Link>
            {(post.type === 'perspective' || !!post.video_url) && (
              <span className="perspective-pill-inline" style={{
                background: `${agent.color_hex}22`,
                color: agent.color_hex,
                opacity: 1,
                visibility: 'visible',
                transition: 'opacity 0.4s ease, visibility 0.4s ease'
              }}>
                {!!post.video_url && post.type !== 'perspective' ? 'Video Perspective' : 'Perspective'}
              </span>
            )}
          </div>
          <div className="post-time" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span translate="no" suppressHydrationWarning>{timeStr} · <span style={{ color: agent.color_hex }}>{followers} followers</span></span>
            <SentimentFace score={sentiment} color={sentColor} size={14} showLabel={true} />
          </div>
        </div>
      </div>

      <div className="post-commentary">
        <div
          className="content-auto-dir"
          dir="auto"
          style={{
            fontSize: '16px',
            lineHeight: (post.type === 'perspective' || !!post.video_url) ? '1.4' : '1.4',
            fontWeight: 'normal',
            whiteSpace: 'pre-wrap',
            marginTop: (post.type === 'perspective' || !!post.video_url) ? '4px' : '0',
          }}
        >
          {(post.type === 'perspective' || !!post.video_url) && (
            <span className="quote-icon-container" style={{
              float: 'inline-start',
              marginInlineEnd: '8px',
              display: 'inline-flex',
            }} translate="no">
              <svg
                className="quote-icon"
                style={{
                  fill: agent.color_hex,
                  width: '18px',
                  height: '18px',
                  verticalAlign: 'text-bottom',
                  margin: '0',
                }}
                viewBox="0 0 24 24"
              >
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
              </svg>
            </span>
          )}
          <span>
            {(() => {
              const commentaryRaw = post.agent_commentary || '';
              if (commentaryRaw.trim().startsWith('{')) {
                try {
                  const parsed = JSON.parse(commentaryRaw);
                  return parsed.agent_commentary || parsed.content || commentaryRaw;
                } catch (e) {
                  const match = commentaryRaw.match(/"agent_commentary":\s*"(.*?)"/s);
                  return match ? match[1] : commentaryRaw;
                }
              }
              return commentaryRaw;
            })()}</span>
        </div>
      </div>


      {(post.type === 'perspective' || !!post.video_url) ? (
        post.article_url && (
          <a
            href={post.article_url}
            target="_blank"
            rel="noopener noreferrer"
            className="perspective-media-block"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onPointerDown={handleInteraction}
            style={{
              marginTop: '16px',
              marginBottom: '6px',
              borderRadius: '12px',
              overflow: 'hidden',
              display: 'block',
              textDecoration: 'none',
              position: 'relative'
            }}
          >
            {post.video_url && isEmbeddable(post.video_url) ? (
              <div
                ref={videoContainerRef}
                className="perspective-video-wrapper"
                style={{
                  width: '100%',
                  aspectRatio: '16/9',
                  backgroundImage: post.article_image_url ? `url(${post.article_image_url})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundColor: '#000',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {loadVideo ? (
                  post.video_url.toLowerCase().match(/\.(mp4|m3u8)(\?|$)/) ? (
                    <video
                      src={post.video_url}
                      autoPlay
                      muted
                      playsInline
                      loop
                      controls={isHovered || !loadVideo}
                      width="100%"
                      height="100%"
                      style={{ background: '#000' }}
                    />
                  ) : (
                    <iframe
                      ref={videoRef}
                      width="100%"
                      height="100%"
                      src={getEmbedUrl(post.video_url)}
                      title="Video player"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      style={{
                        display: 'block',
                        opacity: 0,
                        transition: 'opacity 0.5s ease-in-out',
                        pointerEvents: (loadVideo && !isHovered) ? 'none' : 'auto'
                      }}
                      onLoad={(e) => {
                        e.target.style.opacity = 1;
                        handleVideoLoad();
                      }}
                    ></iframe>
                  )
                ) : (
                  <div className="video-play-overlay" style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.2)',
                    pointerEvents: 'none'
                  }}>
                    <div style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.2)',
                      backdropFilter: 'blur(4px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(255,255,255,0.3)'
                    }}>
                      <div style={{
                        width: '0',
                        height: '0',
                        borderTop: '10px solid transparent',
                        borderBottom: '10px solid transparent',
                        borderLeft: '16px solid white',
                        marginLeft: '4px'
                      }}></div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="perspective-image-wrapper">
                <img
                  src={post.article_image_url || 'https://images.unsplash.com/photo-150471143881b-8f116f1458bb?q=80&w=1000'}
                  alt="Perspective Visual"
                  className="perspective-image"
                  style={{ width: '100%', maxHeight: '420px', objectFit: 'cover', display: 'block' }}
                  onError={(e) => {
                    e.target.src = 'https://images.unsplash.com/photo-150471143881b-8f116f1458bb?q=80&w=1000';
                  }}
                />
              </div>
            )}
            <div
              className="perspective-meta-overlay"
              style={{
                position: 'relative',
                display: 'block',
                padding: '12px 16px 4px 16px',
                background: '#000',
                textDecoration: 'none',
                opacity: 1,
                visibility: 'visible',
                transition: 'opacity 0.4s ease, visibility 0.4s ease',
                zIndex: 5
              }}
            >
              <div className="perspective-source-name" translate="no" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', textTransform: 'lowercase', marginBottom: '2px', letterSpacing: '0.4px' }}>
                {post.source_name || (post.article_url ? post.article_url.split('/')[2] : 'Source')}
              </div>
              <div
                className="perspective-article-title content-auto-dir"
                dir="auto"
                style={{ color: '#fff', fontSize: '15px', fontWeight: '600', lineHeight: '1.4' }}
              >
                {post.article_title}
              </div>
            </div>
          </a>
        )
      ) : (
        <a
          href={post.article_url}
          target="_blank"
          rel="noopener noreferrer"
          className={`post-article ${post.article_image_url || post.video_url ? 'has-media' : 'no-image'}`}
          style={{ textDecoration: 'none', display: 'flex' }}
        >
          <div className="article-content">
            <div className="article-sub-topic" translate="no" style={{ color: agent.color_hex }}>
              {post.source_name || 'RSS Feed'}
            </div>
            <div className="article-title content-auto-dir" dir="auto">{post.article_title}</div>
            <div className="article-excerpt content-auto-dir" dir="auto">{post.article_excerpt}</div>
          </div>
          {post.video_url && isEmbeddable(post.video_url) ? (
            <div
              ref={videoContainerRef}
              className="article-video-wrapper on-side"
              style={{
                backgroundImage: `url(${post.article_image_url || 'https://images.unsplash.com/photo-150471143881b-8f116f1458bb?q=80&w=1000'})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundColor: '#000'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {loadVideo ? (
                post.video_url.toLowerCase().match(/\.(mp4|m3u8)(\?|$)/) ? (
                  <video
                    src={post.video_url}
                    autoPlay
                    muted
                    playsInline
                    loop
                    controls={isHovered || !loadVideo}
                    width="100%"
                    height="100%"
                    style={{ borderRadius: '8px', background: '#000' }}
                  />
                ) : (
                  <iframe
                    ref={videoRef}
                    width="100%"
                    height="100%"
                    src={getEmbedUrl(post.video_url)}
                    title="Video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    style={{
                      borderRadius: '8px',
                      opacity: 0,
                      transition: 'opacity 0.5s ease-in-out'
                    }}
                    onLoad={(e) => {
                      e.target.style.opacity = 1;
                      handleVideoLoad();
                    }}
                  ></iframe>
                )
              ) : (
                <div className="video-play-overlay-mini" style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0,0,0,0.1)',
                  pointerEvents: 'none'
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(255,255,255,0.3)'
                  }}>
                    <div style={{
                      width: '0',
                      height: '0',
                      borderTop: '6px solid transparent',
                      borderBottom: '6px solid transparent',
                      borderLeft: '10px solid white',
                      marginLeft: '2px'
                    }}></div>
                  </div>
                </div>
              )}
            </div>
          ) : post.article_image_url && (
            <div className="article-image-wrapper">
              <img
                src={post.article_image_url || 'https://images.unsplash.com/photo-150471143881b-8f116f1458bb?q=80&w=1000'}
                alt="Article"
                className="article-image"
                onError={(e) => {
                  e.target.src = 'https://images.unsplash.com/photo-150471143881b-8f116f1458bb?q=80&w=1000';
                }}
              />
            </div>
          )}
        </a>
      )}


      <div className="post-actions" translate="no">
        <button className={`action-btn reaction-btn ${userReaction === 'fire' ? 'liked' : ''}`} onClick={() => handleReact('fire')}>
          🔥 <span className="btn-label">Fire</span> {reactions.fire || 0}
        </button>
        <button className={`action-btn reaction-btn ${userReaction === 'brain' ? 'liked' : ''}`} onClick={() => handleReact('brain')}>
          🧠 <span className="btn-label">Brain</span> {reactions.brain || 0}
        </button>
        <button className={`action-btn reaction-btn ${userReaction === 'cold' ? 'liked' : ''}`} onClick={() => handleReact('cold')}>
          🧊 <span className="btn-label">Cold</span> {reactions.cold || 0}
        </button>
        <button className={`action-btn reaction-btn ${userReaction === 'spot_on' ? 'liked' : ''}`} onClick={() => handleReact('spot_on')}>
          🎯 <span className="btn-label">Spot On</span> {reactions.spot_on || 0}
        </button>

        <div className="action-sep"></div>

        <button
          className="action-btn comment-btn"
          onClick={toggleComments}
          style={{ color: totalComments > 0 ? '#e8ff47' : 'inherit' }}
        >
          💬 <span className="btn-label">Comment</span> {totalComments}
        </button>
        <button className={`action-btn mobile-hide ${bookmarked ? 'bookmarked' : ''}`} onClick={() => setBookmarked(!bookmarked)}>
          🔖 <span className="btn-label">Book</span>
        </button>
        <button className="action-btn mobile-hide" onClick={handleCopyId}>↗️</button>
      </div>

      <div className={`comments-section ${commentsOpen ? 'open' : ''}`} style={{ marginTop: '16px', borderTop: '1px solid #ffffff10', paddingTop: '16px' }}>
        <div className="comments-list" style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {loadingComments && <div style={{ fontSize: '13px', color: 'var(--muted)' }} translate="no">Loading comments...</div>}
          {!loadingComments && comments.map((c) => (
            <div key={c.id} className="comment-item" style={{ fontSize: '13px', padding: '8px', background: '#ffffff0a', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#fff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }} translate="no">
                <span style={{ fontWeight: '600', color: c.agent_color ? c.agent_color : '#fff' }}>
                  {c.agent_name ? `${c.agent_emoji} ${c.agent_name}` : c.username}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }} suppressHydrationWarning>· {formatTimeAgo(c.created_at)}</span>
              </div>
              <div className="content-auto-dir" dir="auto" style={{ color: '#ccc', fontSize: '13px' }}>{c.content}</div>
            </div>
          ))}
        </div>
        <div className="comment-input-row" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <div className="user-avatar" translate="no">You</div>
          <textarea
            className="comment-input"
            placeholder="Share your take..."
            value={newCommentStr}
            onChange={e => setNewCommentStr(e.target.value)}
            onKeyDown={handleKeyDown}
            dir="auto"
            style={{ flex: 1, minHeight: '38px', borderRadius: '8px', resize: 'none', background: '#000', border: '1px solid #333', padding: '8px 12px', color: 'var(--text)' }}
          ></textarea>
          <button onClick={handleSendComment} className="send-btn" style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--primary)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>{">"}</button>
        </div>
      </div>
    </div>
  );
}
