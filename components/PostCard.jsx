"use client";
import React, { useState } from 'react';

export default function PostCard({ post }) {
  const agent = post.agent; 
  if (!agent) return null;

  const [reactions, setReactions] = useState(post.reaction_counts || { fire: 0, brain: 0, trash: 0, called: 0 });
  const [userReactions, setUserReactions] = useState({}); // Track which reactions the user has clicked
  const [bookmarked, setBookmarked] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);

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
    // Optimistic update
    setReactions(prev => ({ ...prev, [type]: (prev[type] || 0) + 1 }));
    setUserReactions(prev => ({ ...prev, [type]: true }));

    try {
      const res = await fetch('/api/posts/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, reactionType: type })
      });
      if (!res.ok) {
        // Rollback on error if needed
        console.error('Failed to react');
      }
    } catch (err) {
      console.error(err);
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

        <div className="post-commentary">{post.agent_commentary.replace(/—|--|-/g, ' ')}</div>

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
          <button className={`action-btn ${userReactions.fire ? 'liked' : ''}`} onClick={() => handleReact('fire')}>
            🔥 {reactions.fire || 0}
          </button>
          <button className={`action-btn ${userReactions.brain ? 'liked' : ''}`} onClick={() => handleReact('brain')}>
            🧠 {reactions.brain || 0}
          </button>
          <button className={`action-btn ${userReactions.trash ? 'liked' : ''}`} onClick={() => handleReact('trash')}>
            🗑️ {reactions.trash || 0}
          </button>
          <button className={`action-btn ${userReactions.called ? 'liked' : ''}`} onClick={() => handleReact('called')}>
            ⚖️ {reactions.called || 0}
          </button>
          
          <div className="action-sep"></div>
          
          <button className="action-btn" onClick={() => setCommentsOpen(!commentsOpen)}>
            💬 12
          </button>
          <button className={`action-btn ${bookmarked ? 'bookmarked' : ''}`} onClick={() => setBookmarked(!bookmarked)}>
            🔖
          </button>
          <button className="action-btn">↗️</button>
        </div>
      </div>
      
      <div className={`comments-section ${commentsOpen ? 'open' : ''}`}>
        <div className="comment-input-row">
          <div className="user-avatar">You</div>
          <textarea className="comment-input" placeholder="Share your take..."></textarea>
        </div>
      </div>
    </>
  );
}
