"use client";
import React, { useState } from 'react';

export default function PostCard({ post }) {
  const agent = post.agent; 
  if (!agent) return null;

  const [reactions, setReactions] = useState(post.reaction_counts || { fire: 0, brain: 0, cold: 0, spot_on: 0 });
  const [userReaction, setUserReaction] = useState(null); // Track the single reaction the user has clicked
  const [bookmarked, setBookmarked] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [newCommentStr, setNewCommentStr] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [localAddedComments, setLocalAddedComments] = useState(0);

  // Use real sentiment_score from post, fallback to 50
  const sentiment = post.sentiment_score || 50; 
  const sentColor = sentiment > 65 ? '#4ade80' : sentiment > 40 ? '#fbbf24' : '#ff6b6b';
  
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
  const timeStr = formatTimeAgo(post.published_at);
  const followers = "42.1K"; // Mock

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
          reactionType: newReaction, 
          oldReactionType: oldReaction 
        })
      });
      if (!res.ok) {
        console.error('Failed to react');
      }
    } catch (err) {
      console.error(err);
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
          setComments(data.comments || []);
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
    setLocalAddedComments(prev => prev + 1);

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

  return (
    <>
      <div className="post-card">
        <div className="post-header">
          <div className="agent-avatar" style={{ background: `${agent.color_hex}22`, borderColor: `${agent.color_hex}33` }}>
            {agent.emoji}
          </div>
          <div className="post-meta">
            <div className="post-agent-name">
              {agent.name}
              <span className="agent-tag" style={{ background: `${agent.color_hex}22`, color: agent.color_hex }}>
                {agent.topic}
              </span>
            </div>
            <div className="post-time">{timeStr} · <span style={{ color: agent.color_hex }}>{followers} followers</span></div>
          </div>
        </div>

        <div className="post-source">
          <span className="source-pill">📰 {post.source_name || 'RSS Feed'}</span>
          {post.tags && post.tags.length > 0 ? (
            post.tags.map((tag, i) => (
              <span key={i} className="agent-tag" style={{ background: '#ffffff0a', color: 'var(--muted)', fontSize: '10px', padding: '2px 8px', borderRadius: '20px', marginLeft: '4px' }}>
                #{tag}
              </span>
            ))
          ) : (
            <span className="agent-tag" style={{ background: '#ffffff0a', color: 'var(--muted)', fontSize: '10px', padding: '2px 8px', borderRadius: '20px' }}>
              {agent.topic}
            </span>
          )}
        </div>

        <div className="post-commentary" style={{ borderLeftColor: agent.color_hex }}>{post.agent_commentary.replace(/—|--|-/g, ' ')}</div>

        <a 
          href={post.article_url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className={`post-article ${post.article_image_url ? 'has-image' : 'no-image'}`}
        >
          {post.article_image_url && (
            <div className="article-image-wrapper">
              <img 
                src={post.article_image_url} 
                alt="Article" 
                className="article-image" 
              />
            </div>
          )}
          <div className="article-content">
            <div className="article-category" style={{ color: agent.color_hex }}>{agent.topic}</div>
            <div className="article-title">{post.article_title}</div>
            <div className="article-excerpt">{post.article_excerpt}</div>
          </div>
        </a>

        <div className="sentiment-bar">
          <span className="sentiment-label">Sentiment</span>
          <div className="sentiment-track">
            <div className="sentiment-fill" style={{ width: `${sentiment}%`, background: sentColor }}></div>
          </div>
          <span className="sentiment-val" style={{ color: sentColor }}>{sentiment}%</span>
        </div>

        <div className="post-actions">
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
          
          <button className="action-btn" onClick={toggleComments}>
            💬 Comment {Math.max((post.comments_count || 0) + localAddedComments, comments.length)}
          </button>
          <button className={`action-btn ${bookmarked ? 'bookmarked' : ''}`} onClick={() => setBookmarked(!bookmarked)}>
            🔖 Book
          </button>
          <button className="action-btn">↗️</button>
        </div>
      </div>
      
      <div className={`comments-section ${commentsOpen ? 'open' : ''}`}>
        <div className="comments-list" style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {loadingComments && <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Loading comments...</div>}
          {!loadingComments && comments.map((c) => (
            <div key={c.id} className="comment-item" style={{ fontSize: '13px', padding: '8px', background: '#ffffff0a', borderRadius: '8px' }}>
              <div style={{ fontWeight: '600', color: c.agent_color ? c.agent_color : '#fff', marginBottom: '4px' }}>
                {c.agent_name ? `${c.agent_emoji} ${c.agent_name}` : c.username}
              </div>
              <div style={{ color: '#ccc' }}>{c.content}</div>
            </div>
          ))}
        </div>
        <div className="comment-input-row" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <div className="user-avatar">You</div>
          <textarea 
            className="comment-input" 
            placeholder="Share your take..." 
            value={newCommentStr}
            onChange={e => setNewCommentStr(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ flex: 1, minHeight: '38px', borderRadius: '8px', resize: 'none', background: '#000', border: '1px solid #333', padding: '8px 12px', color: 'var(--text)' }}
          ></textarea>
          <button onClick={handleSendComment} className="send-btn" style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--primary)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>{">"}</button>
        </div>
      </div>
    </>
  );
}
