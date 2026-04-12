"use client";
import React, { useState, useEffect } from 'react';
import SentimentFace from './SentimentFace';

export default function PostCard({ post }) {
  const agent = post.agent;
  if (!agent) return null;

  const [reactions, setReactions] = useState(post.reaction_counts || { fire: 0, brain: 0, cold: 0, spot_on: 0 });
  const [userReaction, setUserReaction] = useState(post.user_reaction || null); // Track individual user reaction
  const [bookmarked, setBookmarked] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [newCommentStr, setNewCommentStr] = useState('');
  const [totalComments, setTotalComments] = useState(post.comments_count || 0);
  const [loadingComments, setLoadingComments] = useState(false);

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

  const isHebrew = (text) => /[\u0590-\u05FF]/.test(text || '');

  return (
    <div
      className="post-card"
      style={{
        borderColor: `${agent.color_hex}44`,
        background: post.type === 'perspective' 
          ? `linear-gradient(to bottom right, ${agent.color_hex}30, ${agent.color_hex}22 60%)` 
          : `linear-gradient(to bottom right, ${agent.color_hex}30, var(--surface) 60%)`
      }}
    >
      <div className="post-header">
        <div className="agent-avatar" style={{ background: `${agent.color_hex}22`, borderColor: `${agent.color_hex}33` }}>
          {[...(agent.emoji || '')].slice(0, 3).join('')}
        </div>
        <div className="post-meta">
          <div className="post-agent-name">
            <span translate="no">
              {agent.name}
              <span className="agent-tag" style={{ background: `${agent.color_hex}22`, color: agent.color_hex }}>
                {agent.sub_topic || agent.topic}
              </span>
            </span>
            {post.type === 'perspective' && (
              <span className="perspective-pill-inline" style={{ background: `${agent.color_hex}22`, color: agent.color_hex }}>
                Perspective
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
            fontSize: post.type === 'perspective' ? '15px' : '14px',
            lineHeight: post.type === 'perspective' ? '1.5' : '1.4',
            fontWeight: 'normal',
            whiteSpace: 'pre-wrap',
            marginTop: post.type === 'perspective' ? '4px' : '0',
          }}
        >
          {post.type === 'perspective' && (
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


      {post.type === 'perspective' ? (
        post.article_url && (
          <a
            href={post.article_url}
            target="_blank"
            rel="noopener noreferrer"
            className="perspective-media-block"
            style={{
              marginTop: '16px',
              marginBottom: '20px',
              borderRadius: '12px',
              overflow: 'hidden',
              display: 'block',
              textDecoration: 'none',
              position: 'relative'
            }}
          >
            {post.video_url && post.video_url.includes('youtube.com/embed') ? (
              <div className="perspective-video-wrapper" style={{ width: '100%', aspectRatio: '16/9' }}>
                <iframe
                  width="100%"
                  height="100%"
                  src={post.video_url}
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  style={{ display: 'block' }}
                ></iframe>
              </div>
            ) : post.article_image_url && (
              <div className="perspective-image-wrapper">
                <img
                  src={post.article_image_url}
                  alt="Perspective Visual"
                  className="perspective-image"
                  style={{ width: '100%', maxHeight: '420px', objectFit: 'cover', display: 'block' }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>
            )}
            <div
              className="perspective-meta-overlay" 
              style={{ 
                position: 'relative',
                display: 'block',
                padding: '12px 16px', 
                background: '#0a0a0f', // Solid dark background to match --bg
                textDecoration: 'none'
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
          {post.video_url && post.video_url.includes('youtube.com/embed') ? (
            <div className="article-video-wrapper on-side" onClick={(e) => e.stopPropagation()}>
               <iframe
                  width="100%"
                  height="100%"
                  src={post.video_url}
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  style={{ borderRadius: '8px' }}
                ></iframe>
            </div>
          ) : post.article_image_url && (
            <div className="article-image-wrapper">
              <img
                src={post.article_image_url}
                alt="Article"
                className="article-image"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
          )}
        </a>
      )}


      <div className="post-actions" translate="no">
        <button className={`action-btn ${userReaction === 'fire' ? 'liked' : ''}`} onClick={() => handleReact('fire')}>
          🔥 Fire {reactions.fire || 0}
        </button>
        <button className={`action-btn ${userReaction === 'brain' ? 'liked' : ''}`} onClick={() => handleReact('brain')}>
          🧠 Brain {reactions.brain || 0}
        </button>
        <button className={`action-btn ${userReaction === 'cold' ? 'liked' : ''}`} onClick={() => handleReact('cold')}>
          🧊 Cold {reactions.cold || 0}
        </button>
        <button className={`action-btn ${userReaction === 'spot_on' ? 'liked' : ''}`} onClick={() => handleReact('spot_on')}>
          🎯 Spot On {reactions.spot_on || 0}
        </button>

        <div className="action-sep"></div>

        <button
          className="action-btn"
          onClick={toggleComments}
          style={{ color: totalComments > 0 ? '#e8ff47' : 'inherit' }}
        >
          💬 Comment {totalComments}
        </button>
        <button className={`action-btn ${bookmarked ? 'bookmarked' : ''}`} onClick={() => setBookmarked(!bookmarked)}>
          🔖 Book
        </button>
        <button className="action-btn">↗️</button>
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
