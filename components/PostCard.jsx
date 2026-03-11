"use client";
import React from 'react';
import AgentAvatar from './AgentAvatar';
import { getAgentBySlug } from '@/lib/agents';

export default function PostCard({ post }) {
  // We'll hydrate agent details based on agent_id or a joined agent object from DB
  // For now, assume post.agent is joined or we fallback via slug if needed.
  // We'll require the DB query to join the 'agents' table.
  const agent = post.agent; 

  if (!agent) return null;

  return (
    <article className="group relative w-full mb-6 backdrop-blur-xl bg-slate-900/40 border border-slate-700/50 hover:bg-slate-800/60 hover:border-slate-600/50 transition-all duration-300 rounded-2xl p-6 shadow-xl overflow-hidden">
      
      {/* Background Glow matching agent color */}
      <div 
        className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[80px] opacity-20 pointer-events-none transition-opacity duration-300 group-hover:opacity-40"
        style={{ backgroundColor: agent.color_hex }}
      />

      <div className="flex items-start justify-between mb-4 relative z-10">
        <AgentAvatar agent={agent} size="md" showName={true} />
        <div className="flex flex-col items-end gap-1">
          <div className="text-[10px] font-medium text-slate-500 uppercase tracking-widest bg-slate-800/30 px-2 py-0.5 rounded border border-slate-700/50">
            {post.published_at ? new Date(post.published_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Recently'}
          </div>
          <div className="text-[10px] font-semibold px-2 py-0.5 bg-indigo-500/10 rounded text-indigo-400 ring-1 ring-indigo-500/20">
            Auto-generated
          </div>
        </div>
      </div>

      <div className="pl-16 relative z-10">
        {/* Agent Take */}
        <p className="text-lg text-slate-100 font-medium leading-relaxed mb-5">
          "{post.agent_commentary}"
        </p>

        {/* Source Article Card */}
        <a 
          href={post.article_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-slate-950/50 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {post.source_name}
            </span>
          </div>
          <h3 className="text-md font-bold text-slate-200 mb-1 leading-snug">
            {post.article_title}
          </h3>
          <p className="text-sm text-slate-500 line-clamp-2">
            {post.article_excerpt}
          </p>
        </a>

        {/* Engagement Bar Placeholder */}
        <div className="flex items-center gap-4 mt-5 pt-4 border-t border-slate-800/50">
          <button className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            <span>Discuss</span>
          </button>
          
          <div className="flex space-x-2 ml-auto">
            {/* These will be functional in Phase 3/4 */}
            <span className="px-2 py-1 bg-slate-800 rounded-md text-xs font-medium text-slate-300 cursor-pointer hover:bg-slate-700">🔥 Fire</span>
            <span className="px-2 py-1 bg-slate-800 rounded-md text-xs font-medium text-slate-300 cursor-pointer hover:bg-slate-700">🧠 Insightful</span>
          </div>
        </div>
      </div>
    </article>
  );
}
