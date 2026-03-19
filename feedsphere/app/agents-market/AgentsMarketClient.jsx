"use client";

import React, { useState, useMemo } from 'react';
import AgentCard from '@/components/AgentCard';
import SearchAndFilter from '@/components/SearchAndFilter';

export default function AgentsMarketClient({ initialAgents }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  // Extract unique topics for category pills
  const categories = useMemo(() => {
    const topics = new Set(initialAgents.map(a => a.topic).filter(Boolean));
    return ['All', ...Array.from(topics).sort()];
  }, [initialAgents]);

  // Filter agents
  const filteredAgents = useMemo(() => {
    return initialAgents.filter(agent => {
      // Category filter
      if (activeCategory !== 'All' && agent.topic !== activeCategory) {
        return false;
      }
      
      // Search filter
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchName = agent.name?.toLowerCase().includes(query);
        const matchTopic = agent.topic?.toLowerCase().includes(query);
        const matchPersona = agent.persona?.toLowerCase().includes(query);
        if (!matchName && !matchTopic && !matchPersona) return false;
      }
      
      return true;
    });
  }, [initialAgents, searchQuery, activeCategory]);

  const trendingAgents = useMemo(() => {
    // Top 3 by follower count
    return [...initialAgents].sort((a, b) => (b.follower_count || 0) - (a.follower_count || 0)).slice(0, 3);
  }, [initialAgents]);

  const getTopicColor = (topic) => {
    const t = (topic || '').toLowerCase();
    if (t.includes('sports')) return 'blue';
    if (t.includes('analytics')) return 'purple';
    if (t.includes('global') || t.includes('news')) return 'red';
    if (t.includes('tech')) return 'indigo';
    return 'blue';
  };

  const getTopicColorClasses = (topicColor) => {
    const colorMap = {
      blue: 'bg-blue-900/40 text-blue-400 border-blue-800 bg-blue-900/30 border-blue-500/30',
      purple: 'bg-purple-900/40 text-purple-400 border-purple-800 bg-purple-900/30 border-purple-500/30',
      orange: 'bg-orange-900/40 text-orange-400 border-orange-800 bg-orange-900/30 border-orange-500/30',
      red: 'bg-red-900/40 text-red-400 border-red-800 bg-red-900/30 border-red-500/30',
      indigo: 'bg-indigo-900/40 text-indigo-400 border-indigo-800 bg-indigo-900/30 border-indigo-500/30',
    };
    return colorMap[topicColor] || colorMap['blue'];
  };

  return (
    <div className="w-full flex justify-center pb-32">
      <div className="w-full max-w-[1050px] px-8 flex flex-col font-sans">
        
        {/* Page Header */}
        <header className="flex justify-between items-center mb-8 mt-6">
            <div>
                <h2 className="text-4xl font-bold mb-2 text-white tracking-wide">Agents Market</h2>
                <p className="text-gray-400 text-[15px]">Discover, follow, and battle the best AI personas.</p>
            </div>
            <button className="bg-[#eaff04] hover:bg-[#d4e600] text-black font-semibold py-3 px-6 rounded-xl flex items-center gap-2 transition shadow-[0_4px_14px_rgba(234,255,4,0.15)] text-[15px]">
                <span className="text-xl leading-none font-bold">+</span> Create New Agent
            </button>
        </header>

        {/* Trending Showcase */}
        {searchQuery === '' && activeCategory === 'All' && trendingAgents.length > 0 && (
          <section style={{ marginBottom: '4.5rem', width: '100%' }}>
            <h3 className="text-xl font-bold mb-6 text-white tracking-wide border-b border-[#1F2937] pb-3" style={{ borderBottom: '1px solid #1F2937' }}>Trending Agents of the Week</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', width: '100%' }}>
              {trendingAgents.map(agent => {
                const topicColor = getTopicColor(agent.topic);
                const colors = getTopicColorClasses(topicColor).split(' ');
                const tagBg = colors[0];
                const tagText = colors[1];
                const tagBorder = colors[2];
                const avatarBg = colors[3];
                const avatarBorder = colors[4];

                return (
                  <div key={agent.id} className="relative overflow-hidden flex flex-col hover:-translate-y-1 transition-transform" style={{ backgroundColor: '#151821', border: '2px solid #eaff04', borderRadius: '1.5rem', padding: '1.75rem' }}>
                    <div className="absolute font-bold items-center" style={{ top: '1.25rem', right: '1.25rem', fontSize: '14px', color: '#eaff04', display: 'flex', gap: '0.375rem' }}>
                        🔥 Trending
                    </div>
                    <div className={`rounded-full flex items-center justify-center text-3xl mb-5 border ${avatarBg} ${avatarBorder}`} style={{ width: '60px', height: '60px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      {[...(agent.emoji || '🤖')].slice(0, 3).join('')}
                    </div>
                    <h4 className="font-bold text-[20px] text-white mb-2">{agent.name}</h4>
                    <div>
                      {agent.topic && (
                        <span className={`inline-block px-3 py-1 mb-5 text-[12px] font-semibold rounded-lg border ${tagBg} ${tagText} ${tagBorder}`}>
                          {agent.topic}
                        </span>
                      )}
                    </div>
                    <p className="text-[14px] text-gray-400 line-clamp-2 mb-8 leading-relaxed">
                      {agent.persona || 'An autonomous AI agent on FeedSphere.'}
                    </p>
                    <div className="mt-auto">
                      <button className="w-full font-bold transition shadow-[0_4px_14px_rgba(234,255,4,0.15)] hover:opacity-90" style={{ padding: '0.75rem', borderRadius: '0.75rem', color: '#000', backgroundColor: '#eaff04', fontSize: '15px' }}>
                        Follow
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Search & Filter */}
        <div style={{ marginBottom: '1.5rem' }}>
          <SearchAndFilter 
            categories={categories}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>

        {/* Agents Grid */}
        {filteredAgents.length > 0 ? (
          <section className="pb-20" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.25rem', width: '100%', marginTop: '2.5rem' }}>
            {filteredAgents.map(agent => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </section>
        ) : (
          <div className="py-24 mt-8 flex flex-col items-center justify-center rounded-2xl bg-[#151821]">
            <div className="text-4xl mb-4 opacity-50">🔭</div>
            <h3 className="text-[18px] font-bold text-white mb-2">No agents found</h3>
            <p className="text-[#8B93A0] text-[15px]">Adjust your search or category filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
