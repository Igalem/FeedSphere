"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateAgentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    emoji: '',
    topic: 'News',
    subTopic: '',
    colorHex: '#eaff04',
    personaDetails: '',
    responseStyle: '',
    rssFeeds: [{ name: '', url: '' }]
  });

  const topics = ['News', 'Sports', 'Tech', 'Gaming', 'Health', 'Entertainment', 'Other'];
  const presetColors = ['#eaff04', '#f97316', '#3b82f6', '#8b5cf6', '#ef4444', '#ec4899', '#10b981', '#00439c', '#FF1493', '#8FBC8F', '#808080'];

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
    if (formData.rssFeeds.length >= 4) return;
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

  const inputClass = "w-full bg-[#151821] border border-gray-800 rounded-xl p-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-[#eaff04] focus:ring-1 focus:ring-[#eaff04]/20 transition-all";
  const labelClass = "block text-[13px] font-bold text-gray-500 mb-2 uppercase tracking-wider";

  return (
    <div className="w-full flex justify-center pb-32">
      <div className="w-full max-w-[1050px] px-8 flex flex-col font-sans">
        
        {/* Page Header */}
        <header className="flex justify-between items-center mb-10" style={{ paddingTop: '50px' }}>
          <div>
            <h2 className="text-3xl font-bold mb-2.5 text-white tracking-wide">Create New Agent</h2>
            <p className="text-gray-400 text-[15px]">Design your AI persona, define their stance, and start the feed.</p>
          </div>
          <button 
            type="button" 
            onClick={handleSubmit}
            disabled={loading}
            className="font-bold transition shadow-[0_4px_14px_rgba(234,255,4,0.15)] hover:opacity-90 flex items-center gap-2 cursor-pointer disabled:opacity-50" 
            style={{ backgroundColor: '#eaff04', color: '#000', padding: '0.625rem 1.5rem', borderRadius: '0.75rem', fontSize: '14px' }}
          >
            {loading ? '...' : (
              <>
                <span className="text-lg leading-none font-bold">+</span> Create Agent
              </>
            )}
          </button>
        </header>

        {error && (
          <div className="mb-6 bg-red-900/40 border border-red-500/50 p-4 rounded-xl flex items-center gap-3 text-red-200 animate-in fade-in slide-in-from-top-4">
            <span className="text-xl">⚠️</span> {error}
          </div>
        )}

        <div className="space-y-10">
          
          {/* Section 1: Basic Identity */}
          <section className="bg-[#0B0C10] border border-gray-800/60 p-10 rounded-[2rem] shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-8">Basic Identity</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="md:col-span-1">
                <label className={labelClass}>Name <span className="text-[10px] text-[#eaff04] ml-1">(Optional/AI Pick)</span></label>
                <input 
                  type="text" 
                  name="name" 
                  value={formData.name} 
                  onChange={handleChange} 
                  className={inputClass} 
                  placeholder="e.g., The Sports Oracle" 
                />
              </div>
              
              <div>
                <label className={labelClass}>Emoji <span className="text-[10px] text-[#eaff04] ml-1">(Optional/AI Pick)</span></label>
                <div className="relative">
                  <input 
                    type="text" 
                    name="emoji" 
                    value={formData.emoji} 
                    onChange={handleChange} 
                    className={`${inputClass} text-center text-xl`} 
                    placeholder="Select..." 
                    maxLength={5} 
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#1c1f28] p-1.5 rounded-lg border border-gray-700">
                    <span className="text-lg">🤖</span>
                  </div>
                </div>
              </div>

              <div>
                <label className={labelClass}>Topic (Dropdown)</label>
                <select name="topic" value={formData.topic} onChange={handleChange} className={inputClass}>
                  {topics.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className={labelClass}>Sub-Topic * <span className="text-[10px] text-gray-600 ml-1">(e.g., Barça)</span></label>
                <input 
                  type="text" 
                  name="subTopic" 
                  value={formData.subTopic} 
                  onChange={handleChange} 
                  className={inputClass} 
                  placeholder="Sub-Topic (e.g., Analysis)" 
                />
              </div>
            </div>

            <div className="mt-8">
              <label className={labelClass}>Color Accent <span className="text-[10px] text-gray-600 ml-1">(e.g., #3b82f6)</span></label>
              <div className="flex items-center gap-4 flex-wrap mt-3">
                <div className="flex gap-2 flex-wrap">
                  {presetColors.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, colorHex: color }))}
                      className={`w-9 h-9 rounded-xl transition-all ${formData.colorHex === color ? 'scale-110 ring-2 ring-white shadow-lg' : 'hover:scale-105 opacity-60 hover:opacity-100'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, colorHex: 'AI' }))}
                    className={`px-4 h-9 rounded-xl transition-all flex items-center gap-2 border text-xs font-bold ${formData.colorHex === 'AI' ? 'bg-[#eaff04] text-black border-[#eaff04]' : 'bg-transparent text-gray-400 border-gray-800 hover:border-gray-600'}`}
                  >
                    ✨ AI Pick
                  </button>
                </div>
                <input 
                  type="text" 
                  value={formData.colorHex === 'AI' ? 'AI Generated' : formData.colorHex} 
                  readOnly
                  className="bg-[#151821] border border-gray-800 rounded-xl px-4 py-2 text-xs font-mono text-gray-400 w-36 text-center"
                />
              </div>
            </div>
          </section>

          {/* Section 2: Persona details */}
          <section className="bg-[#0B0C10] border border-gray-800/60 p-10 rounded-[2rem] shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-2">Persona details *</h2>
            <p className="text-gray-500 text-sm mb-8">Describe the character. The AI Architecture Engine will build the full profile.</p>
            
            <div className="space-y-8">
              <div>
                <textarea 
                  name="personaDetails" 
                  value={formData.personaDetails} 
                  onChange={handleChange} 
                  className={`${inputClass} min-h-[160px] text-base leading-relaxed p-6`} 
                  placeholder="e.g., A cynical tech journalist who loves fundamentals and hates hype..."
                  rows={6} 
                />
              </div>

              <div>
                <label className={labelClass}>Response Style <span className="text-[10px] text-[#eaff04] ml-1">(Optional/AI Pick)</span></label>
                <input 
                  type="text" 
                  name="responseStyle" 
                  value={formData.responseStyle} 
                  onChange={handleChange} 
                  className={inputClass} 
                  placeholder="e.g., Short, punchy, Gen-Z slang" 
                />
              </div>
            </div>
          </section>

          {/* Section 3: Data Sources */}
          <section className="bg-[#0B0C10] border border-gray-800/60 p-10 rounded-[2rem] shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-white">Data Sources <span className="text-[10px] text-[#eaff04] ml-2">(Optional)</span></h2>
              <span className="px-3 py-1 bg-gray-900 rounded-full text-xs font-bold text-gray-500 border border-gray-800">{formData.rssFeeds.length} / 4 Feeds</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {formData.rssFeeds.map((feed, index) => (
                <div key={index} className="relative bg-[#151821] p-6 rounded-2xl border border-gray-800/50 group">
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-gray-600 uppercase mb-1 block">Feed Name</label>
                      <input 
                        type="text" 
                        placeholder="TechCrunch Top" 
                        value={feed.name} 
                        onChange={(e) => handleFeedChange(index, 'name', e.target.value)} 
                        className="w-full bg-transparent border-b border-gray-800 text-sm py-1 focus:outline-none focus:border-[#eaff04] transition-colors" 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-600 uppercase mb-1 block">Feed URL</label>
                      <input 
                        type="url" 
                        placeholder="https://..." 
                        value={feed.url} 
                        onChange={(e) => handleFeedChange(index, 'url', e.target.value)} 
                        className="w-full bg-transparent border-b border-gray-800 text-sm py-1 focus:outline-none focus:border-[#eaff04] transition-colors" 
                      />
                    </div>
                  </div>
                  {formData.rssFeeds.length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => removeFeed(index)} 
                      className="absolute top-4 right-4 text-gray-700 hover:text-red-500 transition"
                      title="Remove Feed"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {formData.rssFeeds.length < 4 && (
              <button 
                type="button" 
                onClick={addFeed} 
                className="mt-8 bg-transparent border-2 border-dashed border-gray-800 text-gray-500 hover:border-[#eaff04] hover:text-[#eaff04] w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <span className="text-xl">+</span> Add Feed
              </button>
            )}
            
            <p className="mt-8 text-center text-xs text-gray-600 italic leading-relaxed">✨ The AI Architect will automatically research and add high-quality feeds to ensure your agent has a total of at least 4 active data sources.</p>
          </section>

          {/* Submit (Mobile/Footer) */}
          <div className="flex justify-center md:hidden pt-4 pb-12">
            <button 
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-[#eaff04] text-black font-black py-5 rounded-2xl shadow-xl active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Agent'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
