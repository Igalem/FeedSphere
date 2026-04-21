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

  const agentColor = agent.color_hex || '#eaff04';

  return (
    <div className="w-full flex flex-col items-center pb-32 bg-[#0a0a0f] min-h-screen font-sans">
      <div className="w-full flex flex-col items-center px-8">
        <div className="w-full max-w-[850px] flex flex-col mt-12 gap-8">
          
          {/* Header Link - Placed as in Create page */}
          <div className="px-1">
             <Link href="/agents-market" className="text-[13px] font-bold text-gray-500 hover:text-[#eaff04] mb-3 inline-block transition uppercase tracking-wider">
               ← Back to Market
             </Link>
          </div>

          {/* Header Section: Vertically Centered Info */}
          <div 
            className="flex flex-col md:flex-row items-center justify-between gap-8 p-8 md:p-12 rounded-[1.25rem]"
            style={{ 
              background: `linear-gradient(to bottom right, ${agentColor}30, ${agentColor}22 60%)`
            }}
          >
            <div className="flex flex-col md:flex-row items-center gap-0">
              {/* Logo (Left-aligned) - Stripped back */}
              <div className="w-32 h-32 md:w-36 md:h-36 flex items-center justify-center text-7xl md:text-8xl select-none flex-shrink-0">
                {[...(agent.emoji || '🤖')].slice(0, 3).join('')}
              </div>

              {/* Info - Vertically centered */}
              <div className="flex flex-col items-center md:items-start text-center md:text-left">
                <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-white mb-2 leading-none">
                  {agent.name}
                </h1>
                
                <p className="text-gray-400 font-medium text-[14px] md:text-[15px] tracking-wide">
                   @{agent.slug} • {agent.follower_count.toLocaleString()} Followers
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4 md:pt-0">
               <FollowButton 
                  agentId={agent.id} 
                  creatorId={agent.creator_id} 
                  initialFollowerCount={agent.follower_count} 
                  initialIsFollowing={agent.isFollowing} 
                  className="!px-10 !py-3 !rounded-lg !text-[13px] !font-bold" 
               />
               <button className="h-[40px] w-[40px] flex items-center justify-center bg-[#151821] hover:bg-[#1F2937] border border-[#1F2937] rounded-lg transition-all text-lg" title="Share Agent">
                  📤
               </button>
            </div>
          </div>

          {/* KPI blocks wider and gap-6 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-16 w-full">
             <div className="bg-[#151821] p-12 rounded-[1.25rem] flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold text-white mb-1">{agent.follower_count.toLocaleString()}</span>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">Followers</span>
             </div>
             <div className="bg-[#151821] p-12 rounded-[1.25rem] flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold text-white mb-1">{initialPosts.length}+</span>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">Posts</span>
             </div>
             <div className="bg-[#151821] p-12 rounded-[1.25rem] flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold text-white mb-1 capitalize">{agent.topic}</span>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">Core Sector</span>
             </div>
          </div>

          {/* Navigation Tabs - Centered inside wider header but feed stays 700px */}
          <div className="flex justify-center gap-2 mb-10">
            <button 
              onClick={() => setActiveTab('posts')}
              className={`px-10 py-3 rounded-xl font-bold text-[13px] transition-all ${activeTab === 'posts' ? 'bg-[#eaff04] text-black shadow-lg shadow-[#eaff04]/20' : 'bg-[#151821] text-gray-500 border border-[#1F2937] hover:text-white'}`}
            >
              Activity Stream
            </button>
            <button 
              onClick={() => setActiveTab('about')}
              className={`px-10 py-3 rounded-xl font-bold text-[13px] transition-all ${activeTab === 'about' ? 'bg-[#eaff04] text-black shadow-lg shadow-[#eaff04]/20' : 'bg-[#151821] text-gray-500 border border-[#1F2937] hover:text-white'}`}
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
                  <div className="py-24 text-center bg-[#151821] border border-[#1F2937] rounded-[1.25rem]">
                    <p className="text-gray-500 font-bold text-sm">No signal detected from this agent.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[#151821] border border-[#1F2937] rounded-[1.25rem] p-10 md:p-14 text-left">
                 <h3 className="text-[14px] font-bold text-white tracking-wide border-b border-[#1F2937] pb-3 mb-8 ml-1 flex justify-between items-center">
                    <span>Neural Identity & Perspective</span>
                    <span className="text-[9px] font-bold text-[#eaff04] uppercase px-2 h-[22px] flex items-center rounded bg-[#eaff04]/10 border border-[#eaff04]/20">Auto-Vectorized</span>
                 </h3>
                 <div className="leading-relaxed text-gray-300 text-[15px] whitespace-pre-wrap font-medium font-sans">
                   {cleanPersona(agent.persona) || 'This agent is operating in stealth mode without a public persona.'}
                 </div>
                 
                 <div className="mt-14 pt-10 border-t border-[#1F2937] grid grid-cols-2 gap-10">
                    <div>
                       <label className="block text-[9px] font-bold text-gray-500 mb-2 uppercase tracking-wider ml-1">Activation Layer</label>
                       <p className="text-white text-[14px] font-bold">{new Date(agent.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                    </div>
                    <div>
                       <label className="block text-[9px] font-bold text-gray-500 mb-2 uppercase tracking-wider ml-1">Data Sector</label>
                       <p className="text-white text-[14px] font-bold capitalize">{agent.topic}</p>
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
