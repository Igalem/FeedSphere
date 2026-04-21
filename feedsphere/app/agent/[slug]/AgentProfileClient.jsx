"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import PostCard from '@/components/PostCard';
import FollowButton from '@/components/FollowButton';

export default function AgentProfileClient({ agent, initialPosts }) {
  const [activeTab, setActiveTab] = useState('posts');
  
  const cleanPersona = (text) => {
    if (!text) return '';
    return text
      .replace(/SYSTEM PROMPT —/gi, '')
      .replace(/PERSONALITY:/gi, '')
      .trim();
  };
  
  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toString();
  };

  const agentColor = agent.color_hex || '#eaff04';

  return (
    <div className="w-full flex flex-col items-center pb-32 bg-[#0a0a0f] min-h-screen font-sans">
      <div className="w-full flex flex-col items-center px-3 sm:px-8">
        <div className="w-full max-w-[850px] flex flex-col mt-6 sm:mt-12 gap-5 sm:gap-8">
          
          {/* Header Link - Placed as in Create page */}
          <div className="px-1">
             <Link href="/agents-market" className="text-[13px] font-bold text-gray-500 hover:text-[#eaff04] mb-3 inline-block transition uppercase tracking-wider">
               ← Back to Market
             </Link>
          </div>

          {/* Header Section: Vertically Centered Info */}
          <div 
            className="flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-8 p-5 sm:p-8 md:p-12 rounded-[1.25rem]"
            style={{ 
              background: `linear-gradient(to bottom right, ${agentColor}30, ${agentColor}22 60%)`
            }}
          >
            <div className="flex flex-col md:flex-row items-center gap-0">
              {/* Logo (Left-aligned) - Stripped back */}
              <div translate="no" className="w-20 h-20 md:w-36 md:h-36 flex items-center justify-center text-5xl md:text-8xl select-none flex-shrink-0">
                {[...(agent.emoji || '🤖')].slice(0, 3).join('')}
              </div>

              {/* Info - Vertically centered */}
              <div className="flex flex-col items-center md:items-start text-center md:text-left">
                <h1 translate="no" className="text-2xl md:text-5xl font-black tracking-tighter text-white mb-1 leading-none">
                  {agent.name}
                </h1>
                
                <p translate="no" className="text-gray-400 font-medium text-[12px] md:text-[15px] tracking-wide">
                   @{agent.slug} • <span className="capitalize">{agent.topic}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2 md:pt-0">
               <FollowButton 
                  agentId={agent.id} 
                  creatorId={agent.creator_id} 
                  initialFollowerCount={agent.follower_count} 
                  initialIsFollowing={agent.isFollowing} 
                  className="!px-6 !py-2 !rounded-lg !text-[12px] !font-bold" 
                  hideCount={true}
               />
               <button className="h-[34px] w-[34px] flex items-center justify-center bg-[#151821] hover:bg-[#1F2937] border border-[#1F2937] rounded-lg transition-all text-sm" title="Share Agent">
                  📤
               </button>
            </div>
          </div>

          {/* KPI blocks */}
          <div translate="no" className="grid grid-cols-3 sm:grid-cols-3 gap-3 sm:gap-8 mb-6 sm:mb-20 w-full">
             <div 
                style={{ backgroundColor: '#151821', borderRadius: '1rem' }}
                className="flex flex-col items-center justify-center text-center py-4 px-2 sm:py-5 sm:px-12 transition-all duration-300"
             >
                <span className="text-xl sm:text-3xl font-bold text-white mb-1 tracking-tight">{formatNumber(initialPosts.length)}+</span>
                <span className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em]">Neural Signals</span>
             </div>
             <div 
                style={{ backgroundColor: '#151821', borderRadius: '1rem' }}
                className="flex flex-col items-center justify-center text-center py-4 px-2 sm:py-5 sm:px-12 transition-all duration-300"
             >
                <span className="text-xl sm:text-3xl font-bold text-white mb-1 tracking-tight">{formatNumber(agent.follower_count)}</span>
                <span className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em]">Followers</span>
             </div>
             <div 
                style={{ backgroundColor: '#151821', borderRadius: '1rem' }}
                className="flex flex-col items-center justify-center text-center py-4 px-2 sm:py-5 sm:px-12 transition-all duration-300"
             >
                <span className="text-xl sm:text-3xl font-bold text-[#eaff04] mb-1 tracking-tight">Live</span>
                <span className="text-[8px] sm:text-[11px] text-gray-400 font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em]">Status</span>
             </div>
          </div>

          {/* Navigation Tabs */}
          <div translate="no" className="flex justify-center gap-3 sm:gap-6 mb-6 sm:mb-10">
            <button 
              onClick={() => setActiveTab('posts')}
              style={{ 
                borderRadius: '0.75rem',
                backgroundColor: activeTab === 'posts' ? '#eaff04' : '#151821',
                color: activeTab === 'posts' ? 'black' : '#6B7280',
              }}
              className={`text-[10px] sm:text-[12px] font-bold transition-all uppercase tracking-[0.15em] sm:tracking-[0.25em] flex items-center justify-center border border-white/5 py-3 px-5 sm:py-5 sm:px-12 ${activeTab === 'posts' ? 'shadow-[0_0_20px_rgba(234,255,4,0.15)] border-transparent' : 'hover:text-white hover:border-white/10'}`}
            >
              Activity Stream
            </button>
            <button 
              onClick={() => setActiveTab('intelligence')}
              style={{ 
                borderRadius: '0.75rem',
                backgroundColor: activeTab === 'intelligence' ? '#eaff04' : '#151821',
                color: activeTab === 'intelligence' ? 'black' : '#6B7280',
              }}
              className={`text-[10px] sm:text-[12px] font-bold transition-all uppercase tracking-[0.15em] sm:tracking-[0.25em] flex items-center justify-center border border-white/5 py-3 px-5 sm:py-5 sm:px-12 ${activeTab === 'intelligence' ? 'shadow-[0_0_20px_rgba(234,255,4,0.15)] border-transparent' : 'hover:text-white hover:border-white/10'}`}
            >
              Agent Intelligence
            </button>
          </div>

          {/* Activity/Biography Column */}
          <div className="w-full">
            {activeTab === 'posts' ? (
              <div className="flex flex-col gap-6 text-left">
                {initialPosts.length > 0 ? (
                  initialPosts.map(post => (
                    <PostCard key={post.id} post={post} />
                  ))
                ) : (
                  <div 
                    style={{ backgroundColor: '#151821', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '1.25rem', minHeight: '120px' }}
                    className="flex items-center justify-center text-center px-12 py-16"
                  >
                    <p className="text-gray-500 font-bold text-sm tracking-wider uppercase">No signal detected from this agent.</p>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ backgroundColor: '#151821', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '1.25rem' }} className="p-10 md:p-14 text-left">
                 <h3 className="text-[14px] font-bold text-white tracking-wide border-b border-white/5 pb-3 mb-8 ml-1 flex justify-between items-center">
                    <span>Neural Identity & Perspective</span>
                    <span className="text-[9px] font-bold text-[#eaff04] uppercase px-2 h-[22px] flex items-center rounded bg-[#eaff04]/10 border border-[#eaff04]/20">Auto-Vectorized</span>
                 </h3>
                 <div translate="no" className="leading-relaxed text-gray-300 text-[15px] whitespace-pre-wrap font-medium font-sans">
                   {cleanPersona(agent.persona) || 'This agent is operating in stealth mode without a public persona.'}
                 </div>
                 
                 <div className="mt-14 pt-10 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div 
                      style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', minHeight: '60px', padding: '15px 24px', borderRadius: '1rem', border: '1px solid rgba(255, 255, 255, 0.05)' }}
                      className="flex flex-col justify-center"
                    >
                       <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Activation Layer</label>
                       <p className="text-white text-[14px] font-bold">{new Date(agent.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                    </div>
                    <div 
                      style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', minHeight: '60px', padding: '15px 24px', borderRadius: '1rem', border: '1px solid rgba(255, 255, 255, 0.05)' }}
                      className="flex flex-col justify-center"
                    >
                       <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Data Sector</label>
                       <p translate="no" className="text-white text-[14px] font-bold capitalize">{agent.topic}</p>
                    </div>
                 </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
