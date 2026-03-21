"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CreateAgentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    emoji: '🤖',
    topic: 'Tech',
    subTopic: '',
    colorHex: '#eaff04',
    personaDetails: '',
    responseStyle: '',
    rssFeeds: [
      { name: '', url: '' }
    ]
  });

  const topics = ['Tech', 'Sports', 'Gaming', 'News', 'Entertainment', 'Finance', 'Health'];
  const presetColors = ['#eaff04', '#ef4444', '#f97316', '#3b82f6', '#6366f1', '#a855f7'];
  const presetEmojis = ['🤖', '💻', '📈', '🎮', '🏀', '🎬', '📰', '⚕️', '⚡', '🔥', '🧠', '⚔️', '🕵️'];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFeedChange = (index, field, value) => {
    setFormData(prev => {
      const newFeeds = [...prev.rssFeeds];
      newFeeds[index][field] = value;
      return { ...prev, rssFeeds: newFeeds };
    });
  };

  const addFeed = () => {
    setFormData(prev => ({
      ...prev,
      rssFeeds: [...prev.rssFeeds, { name: '', url: '' }]
    }));
  };

  const removeFeed = (index) => {
    setFormData(prev => ({
      ...prev,
      rssFeeds: prev.rssFeeds.filter((_, i) => i !== index)
    }));
  };

  const handleAiColorPick = () => {
    const randomColor = presetColors[Math.floor(Math.random() * presetColors.length)];
    setFormData(prev => ({ ...prev, colorHex: randomColor }));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    const validFeeds = formData.rssFeeds.filter(f => f.name.trim() !== '' && f.url.trim() !== '');

    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, rssFeeds: validFeeds })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create agent');

      router.push('/agents-market');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // STANDARD HIGH-PADDING HEIGHTS for all inputs & selects
  const inputClass = "bg-[#0B0E14] border border-[#1F2937] rounded-xl px-5 h-[56px] placeholder-gray-600 focus:outline-none focus:border-[#eaff04] transition-all text-[15px] text-white w-full";
  const labelClass = "block text-[12px] font-bold text-gray-500 mb-2 uppercase tracking-wider";

  // Shared button styles matching input heights
  const primaryButtonStyle = {
    backgroundColor: '#eaff04',
    color: '#000',
    height: '56px',
    padding: '0 2rem',
    borderRadius: '0.75rem',
    fontSize: '15px',
    fontWeight: 'bold',
    boxShadow: '0 4px 14px rgba(234,255,4,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  };

  const secondaryButtonStyle = {
    backgroundColor: 'transparent',
    color: '#eaff04',
    height: '56px',
    padding: '0 1.5rem',
    borderRadius: '0.75rem',
    fontSize: '14px',
    fontWeight: 'bold',
    border: '1px solid rgba(234,255,4,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
  };

  return (
    <div className="w-full flex justify-center pb-24 font-sans text-white">
      <div className="w-full max-w-[900px] px-8 flex flex-col">
        
        {/* Header */}
        <header className="flex justify-between items-end mb-12" style={{ paddingTop: '50px' }}>
          <div>
            <Link href="/agents-market" className="text-[13px] font-bold text-gray-500 hover:text-[#eaff04] mb-3 inline-block transition uppercase tracking-wider">
              ← Back to Market
            </Link>
            <h2 className="text-3xl font-bold mb-2 text-white">Create New Agent</h2>
            <p className="text-gray-400 text-[15px]">Design an autonomous persona, define their stance, and connect live datasets.</p>
          </div>
        </header>

        {error && (
          <div className="mb-6 bg-red-900/40 border border-red-500/50 p-4 rounded-xl flex items-center gap-3 text-red-200 min-h-[56px]">
            <span className="text-xl">⚠️</span> {error}
          </div>
        )}

        <div style={{ backgroundColor: '#151821', border: '1px solid #1F2937', borderRadius: '1.25rem', padding: '2.5rem' }}>
          <form className="flex flex-col gap-10">
            
            {/* Block 1: Basic Identity */}
            <div className="flex flex-col gap-6">
              <h3 className="text-[18px] font-bold text-white tracking-wide border-b border-[#1F2937] pb-3">Basic Identity</h3>
              
              {/* Line 1: Emoji, Name, Color */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                <div className="md:col-span-2">
                  <label className={labelClass}>Emoji</label>
                  <div className="relative">
                    <select 
                      name="emoji"
                      value={formData.emoji}
                      onChange={handleChange}
                      className={`${inputClass} appearance-none text-center cursor-pointer`}
                      style={{ paddingLeft: '1rem', paddingRight: '1rem' }}
                    >
                      {presetEmojis.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                    <div className="pointer-events-none absolute top-0 bottom-0 right-3 flex items-center text-xs opacity-50">
                      ▼
                    </div>
                  </div>
                </div>

                <div className="md:col-span-7">
                  <label className={labelClass}>Name</label>
                  <input 
                    type="text" 
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className={inputClass} 
                    placeholder="e.g. Protocol Oracle"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className={labelClass}>Color</label>
                  {/* Color options wrapper ensuring exact 56px height to match inputs */}
                  <div className="flex items-center gap-3 bg-[#0B0E14] border border-[#1F2937] rounded-xl px-2 h-[56px]">
                    <div className="flex-1 overflow-hidden rounded-lg">
                      <input 
                        type="color" 
                        value={formData.colorHex} 
                        onChange={(e) => setFormData(prev => ({ ...prev, colorHex: e.target.value }))}
                        className="w-full h-[40px] border-none bg-transparent cursor-pointer overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none block" 
                        title="Manual Color Pick"
                      />
                    </div>
                    <button 
                      type="button" 
                      onClick={handleAiColorPick}
                      className="px-3 h-[40px] flex items-center gap-2 rounded-lg bg-[#151821] border border-[#1F2937] hover:border-[#eaff04] text-[12px] font-bold uppercase tracking-wider text-gray-400 hover:text-white transition"
                      title="Agent Picker"
                    >
                      <span>✨</span> Auto
                    </button>
                  </div>
                </div>

              </div>

              {/* Line 2: Topic, Sub-Topic */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelClass}>Topic</label>
                  <div className="relative">
                    <select 
                      name="topic"
                      value={formData.topic}
                      onChange={handleChange}
                      className={`${inputClass} appearance-none cursor-pointer`}
                    >
                      {topics.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-5 text-gray-400">
                      ▼
                    </div>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Sub-Topic</label>
                  <input 
                    type="text" 
                    name="subTopic"
                    value={formData.subTopic}
                    onChange={handleChange}
                    placeholder="e.g. Cryptocurrency"
                    className={inputClass} 
                  />
                </div>
              </div>
            </div>

            {/* Block 2: Persona details */}
            <div className="flex flex-col gap-6 pt-2 border-t border-[#1F2937] border-dashed">
              <div className="flex justify-between items-center border-b border-[#1F2937] pb-3 mb-2">
                <h3 className="text-[18px] font-bold text-white tracking-wide">Persona details</h3>
                <span className="text-[10px] font-bold text-[#eaff04] uppercase px-3 h-[28px] flex items-center rounded bg-[#eaff04]/10 border border-[#eaff04]/20 hidden sm:flex">Vector Search Enabled</span>
              </div>
              
              {/* Line 3: The input */}
              <div>
                <label className={labelClass}>System Prompt & Identity Directives</label>
                <textarea 
                  name="personaDetails"
                  value={formData.personaDetails}
                  onChange={handleChange}
                  rows="3" 
                  className="w-full bg-[#0B0E14] border border-[#1F2937] rounded-xl px-5 py-4 placeholder-gray-600 focus:outline-none focus:border-[#eaff04] transition-all text-[15px] font-mono leading-relaxed text-white resize-y min-h-[112px]"
                  placeholder="You are an uncompromising analyst... Core focus: Truths and algorithms."
                ></textarea>
              </div>

              {/* Line 4: Response Style Guidance */}
              <div>
                <label className={labelClass}>Response Style Guidance</label>
                <input 
                  type="text" 
                  name="responseStyle"
                  value={formData.responseStyle}
                  onChange={handleChange}
                  placeholder="Short, direct, data-driven, occasionally cynical."
                  className={inputClass} 
                />
              </div>
            </div>

            {/* Block 3: Data Sources */}
            <div className="flex flex-col gap-6 pt-2 border-t border-[#1F2937] border-dashed">
              <div className="flex justify-between items-center border-b border-[#1F2937] pb-3 mb-2">
                <h3 className="text-[18px] font-bold text-white tracking-wide">Data Sources (RSS)</h3>
              </div>
              
              {/* Line 5: Data Sources (RSS) input rows */}
              <div className="space-y-4">
                {formData.rssFeeds.map((feed, index) => (
                  <div key={index} className="flex flex-col sm:flex-row items-end gap-4 pb-4 border-b border-[#1F2937]/50 last:border-0 last:pb-0">
                    <div className="flex-1 w-full">
                      <label className="text-[10px] font-bold text-gray-500 uppercase mb-1.5 block">Feed Name</label>
                      <input 
                        type="text" 
                        value={feed.name}
                        onChange={(e) => handleFeedChange(index, 'name', e.target.value)}
                        placeholder="Feed Title" 
                        className={inputClass} 
                      />
                    </div>
                    <div className="flex-1 w-full">
                      <label className="text-[10px] font-bold text-gray-500 uppercase mb-1.5 block">Feed URL</label>
                      <input 
                        type="url" 
                        value={feed.url}
                        onChange={(e) => handleFeedChange(index, 'url', e.target.value)}
                        placeholder="https://..." 
                        className={`${inputClass} font-mono`} 
                      />
                    </div>
                    {formData.rssFeeds.length > 1 && (
                      <div className="pb-1 sm:pb-0 w-full sm:w-auto flex justify-end">
                        <button 
                          type="button" 
                          onClick={() => removeFeed(index)}
                          className="h-[56px] px-5 rounded-xl text-red-400 hover:bg-red-400/10 border border-transparent hover:border-red-400/20 transition flex items-center justify-center cursor-pointer" 
                          title="Remove feed"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-2">
                <button 
                  type="button" 
                  onClick={addFeed}
                  style={secondaryButtonStyle}
                  className="hover:bg-[#eaff04]/10"
                >
                  <span className="text-lg leading-none">+</span> Add Data Source
                </button>
                <div className="text-[12.5px] text-gray-500 flex items-center gap-2">
                  <span>✨</span> The AI Architect will automatically add ~3 additional feeds.
                </div>
              </div>
            </div>

            {/* Block 4: Final Actions */}
            <div className="pt-8 mt-2 border-t border-[#1F2937] flex flex-col sm:flex-row justify-end items-center gap-6">
              <div className="text-[14px] text-gray-500 italic hidden sm:block">
                Ready to deploy your agent into the market?
              </div>
              <button 
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                style={primaryButtonStyle}
                className="w-full sm:w-auto hover:opacity-90 active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Processing...' : (
                  <>
                    <span className="text-lg leading-none">+</span> Deploy Agent
                  </>
                )}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
