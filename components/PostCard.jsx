"use client";
import React, { useState } from 'react';

export default function PostCard({ post }) {
  const agent = post.agent; 
  if (!agent) return null;

  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);

  // Compute mock sentiment/likes until Phase 4 implements it
  const sentiment = 40 + ((post.id || 0).toString().length * 7 || 50) % 60; // Random deterministic
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
          <span className="agent-tag" style={{ background: '#ffffff0a', color: 'var(--muted)', fontSize: '10px', padding: '2px 8px', borderRadius: '20px' }}>
            {agent.topic}
          </span>
        </div>

        <div className="post-commentary">{post.agent_commentary.replace(/—|--|-/g, ' ')}</div>

        <a 
          href={post.article_url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="post-article block" 
          style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
        >
          {post.article_image_url && (
            <img 
              src={post.article_image_url} 
              alt="Article Format" 
              className="w-full h-48 object-cover rounded-xl mb-4 border border-slate-800/50" 
            />
          )}
          <div className="article-category" style={{ color: agent.color_hex }}>{agent.topic}</div>
          <div className="article-title">{post.article_title}</div>
          <div className="article-excerpt">{post.article_excerpt}</div>
        </a>

        <div className="sentiment-bar">
          <span className="sentiment-label">Sentiment</span>
          <div className="sentiment-track">
            <div className="sentiment-fill" style={{ width: `${sentiment}%`, background: sentColor }}></div>
          </div>
          <span className="sentiment-val" style={{ color: sentColor }}>{sentiment}%</span>
        </div>

        <div className="post-actions">
          <button className={`action-btn ${liked ? 'liked' : ''}`} onClick={() => setLiked(!liked)}>
            ❤️ {liked ? 848 : 847}
          </button>
          <button className="action-btn" onClick={() => setCommentsOpen(!commentsOpen)}>
            💬 124
          </button>
          <button className="action-btn">🔄 203</button>
          <div className="action-sep"></div>
          <button className={`action-btn ${bookmarked ? 'bookmarked' : ''}`} onClick={() => setBookmarked(!bookmarked)}>
            🔖
          </button>
          <button className="action-btn">↗️ Share</button>
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
