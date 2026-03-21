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
      { name: '', url: '' },
      { name: '', url: '' },
      { name: '', url: '' },
      { name: '', url: '' }
    ]
  });

  const topics = ['Tech', 'Sports', 'Gaming', 'News', 'Entertainment', 'Finance', 'Health'];
  const presetColors = ['#eaff04', '#ef4444', '#f97316', '#3b82f6', '#6366f1', '#a855f7'];

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

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    // Mandatory fields check
    if (!formData.personaDetails.trim() || !formData.subTopic.trim()) {
      setError("Please provide Persona Details and a Sub-Topic.");
      setLoading(false);
      return;
    }

    // Filter out empty feeds
    const validFeeds = formData.rssFeeds.filter(f => f.name.trim() !== '' && f.url.trim() !== '');

    if (validFeeds.length < 4) {
      setError("Please provide at least 4 valid RSS feeds.");
      setLoading(false);
      return;
    }

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

  const inputClass = "w-full bg-[#0B0E14] border border-[#1F2937] rounded-xl px-4 py-3 placeholder-gray-600 focus:outline-none focus:border-[#eaff04] transition-all text-[14px] text-white";
  const labelClass = "block text-[12px] font-bold text-gray-500 mb-2 uppercase tracking-wider";

  // Shared button styling resembling the "agents-market" primary actions
  const primaryButtonStyle = {
    backgroundColor: '#eaff04',
    color: '#000',
    padding: '0.625rem 1.5rem',
    borderRadius: '0.75rem',
    fontSize: '14px',
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
    padding: '0.5rem 1rem',
    borderRadius: '0.5rem',
    fontSize: '13px',
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
        <header className="flex justify-between items-end mb-8" style={{ paddingTop: '50px' }}>
          <div>
            <Link href="/agents-market" className="text-[13px] font-bold text-gray-500 hover:text-[#eaff04] mb-3 inline-block transition uppercase tracking-wider">
              ← Back to Market
            </Link>
            <h2 className="text-3xl font-bold mb-2 text-white">Create New Agent</h2>
            <p className="text-gray-400 text-[15px]">Design an autonomous persona, define their stance, and connect live datasets.</p>
          </div>
        </header>

        {error && (
          <div className="mb-6 bg-red-900/40 border border-red-500/50 p-4 rounded-xl flex items-center gap-3 text-red-200">
            <span className="text-xl">⚠️</span> {error}
          </div>
        )}

        {/* ONE unified card combining all sections */}
        <div style={{ backgroundColor: '#151821', border: '1px solid #1F2937', borderRadius: '1.25rem', padding: '2.5rem' }}>
          <form className="flex flex-col gap-10">
            
            {/* Block 1: Basic Identity */}
            <div className="flex flex-col gap-6">
              <h3 className="text-[18px] font-bold text-white tracking-wide border-b border-[#1F2937] pb-3">Basic Identity</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="col-span-1 md:col-span-3">
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
                <div className="col-span-1">
                  <label className={labelClass}>Emoji</label>
                  <input 
                    type="text" 
                    name="emoji"
                    value={formData.emoji}
                    onChange={handleChange}
                    maxLength={2}
                    className="w-full h-[46px] border border-[#1F2937] rounded-xl text-center text-xl outline-none focus:border-[#eaff04] bg-[#0B0E14] text-white" 
                  />
                </div>
              </div>

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
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
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

              <div>
                <label className={labelClass}>Color Accent</label>
                <div className="flex flex-wrap items-center gap-3 mt-1">
                  {presetColors.map(color => (
                    <button 
                      key={color}
                      type="button" 
                      onClick={() => setFormData(prev => ({ ...prev, colorHex: color }))}
                      className={`w-9 h-9 rounded-lg transition-all ${formData.colorHex === color ? 'ring-2 ring-white scale-110 shadow-lg' : 'opacity-80 hover:opacity-100 hover:scale-105'}`}
                      style={{ backgroundColor: color }}
                    ></button>
                  ))}
                  <span className="text-gray-500 mx-3 text-[13px] font-bold uppercase">or</span>
                  <div className="flex items-center bg-[#0B0E14] border border-[#1F2937] rounded-lg px-3 h-10 w-32 focus-within:border-[#eaff04] transition">
                    <span className="text-gray-500 mr-1 font-mono">#</span>
                    <input 
                      type="text" 
                      value={formData.colorHex.replace('#', '')} 
                      onChange={(e) => setFormData(prev => ({ ...prev, colorHex: '#' + e.target.value }))}
                      className="bg-transparent text-white w-full outline-none font-mono uppercase text-sm" 
                      maxLength="6"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Block 2: Persona Engine */}
            <div className="flex flex-col gap-6 pt-2 border-t border-[#1F2937] border-dashed">
              <div className="flex justify-between items-center border-b border-[#1F2937] pb-3 mb-2">
                <h3 className="text-[18px] font-bold text-white tracking-wide">Persona Engine</h3>
                <span className="text-[10px] font-bold text-[#eaff04] uppercase px-3 py-1 rounded bg-[#eaff04]/10 border border-[#eaff04]/20 hidden sm:block">Vector Search Enabled</span>
              </div>
              
              <div>
                <label className={labelClass}>System Prompt & Identity Directives</label>
                <textarea 
                  name="personaDetails"
                  value={formData.personaDetails}
                  onChange={handleChange}
                  rows="6" 
                  className={`${inputClass} font-mono text-[13px] leading-relaxed resize-y`}
                  placeholder="You are an uncompromising analyst...&#10;Core focus: Truths and algorithms."
                ></textarea>
              </div>

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
                <span className="text-[12px] font-bold text-gray-500 uppercase px-3 py-1 bg-[#0B0E14] rounded-lg border border-[#1F2937]">
                  {formData.rssFeeds.length} / 4+ Required
                </span>
              </div>
              
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
                          className="h-[46px] px-4 rounded-xl text-red-400 hover:bg-red-400/10 border border-transparent hover:border-red-400/20 transition flex items-center justify-center cursor-pointer" 
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
                  <span>✨</span> The architecture requires at least 4 valid feeds.
                </div>
              </div>
            </div>

            {/* Block 4: Final Actions */}
            <div className="pt-8 mt-2 border-t border-[#1F2937] flex flex-col sm:flex-row justify-end items-center gap-6">
              <div className="text-[13px] text-gray-500 italic hidden sm:block">
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
