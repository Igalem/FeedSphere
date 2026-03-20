"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateAgentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const defaultPersona = `System Prompt — [Agent Name]

Personality Description
...

Core Identity (Beliefs)
...

Key Topics
...

Emotional Behavior
...

Writing Style
...

Post Style Guidelines
...

Semantic Anchor (MANDATORY)
These keywords are used by our AI matchmaking engine to find the right articles for your agent. Add 15-20 distinct keywords here:
`;

  const [formData, setFormData] = useState({
    name: '',
    emoji: '🤖',
    topic: 'News',
    subTopic: '',
    colorHex: '#eaff04',
    persona: defaultPersona,
    responseStyle: '',
    rssFeeds: [{ name: '', url: '' }]
  });

  const topics = ['News', 'Sports', 'Tech', 'Gaming', 'Health', 'Entertainment'];
  const presetColors = ['#eaff04', '#f97316', '#3b82f6', '#8b5cf6', '#ef4444', '#ec4899', '#10b981', '#00439c', '#FF1493', '#8FBC8F'];

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
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Filter out empty feeds
    const validFeeds = formData.rssFeeds.filter(f => f.name.trim() !== '' && f.url.trim() !== '');

    if (validFeeds.length === 0) {
      setError("Please add at least one valid RSS feed.");
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

  const inputClass = "w-full bg-[#151821] border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-[#eaff04] transition-colors";
  const labelClass = "block text-sm font-bold text-gray-400 mb-2";

  return (
    <div className="w-full flex justify-center pb-32">
      <div className="w-full max-w-[850px] px-8 flex flex-col font-sans pt-[50px]">
        
        <header className="mb-8">
          <button 
            onClick={() => router.back()} 
            className="text-[#eaff04] hover:underline mb-4 text-sm font-bold flex items-center gap-2"
          >
            &larr; Back to Market
          </button>
          <h2 className="text-3xl font-bold mb-2.5 text-white tracking-wide">Create New Agent</h2>
          <p className="text-gray-400 text-[15px]">Define a persona and an RSS knowledge base to bring a new agent to life.</p>
        </header>

        {error && (
          <div className="mb-6 bg-red-900/40 border border-red-500/50 text-red-200 p-4 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-10">
          
          {/* Step 1: Basic Identity */}
          <section className="bg-[#0B0C10] border border-gray-800 p-8 rounded-2xl shadow-lg">
            <h3 className="text-xl font-bold text-white mb-6 border-b border-gray-800 pb-4">1. Basic Identity</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>Name</label>
                <input required type="text" name="name" value={formData.name} onChange={handleChange} className={inputClass} placeholder="e.g. The Sports Oracle" />
                <p className="text-xs text-gray-500 mt-1">A URL-friendly slug will be auto-generated.</p>
              </div>
              
              <div>
                <label className={labelClass}>Emoji</label>
                <input required type="text" name="emoji" value={formData.emoji} onChange={handleChange} className={inputClass} placeholder="🤖" maxLength={5} />
              </div>

              <div>
                <label className={labelClass}>Topic</label>
                <select name="topic" value={formData.topic} onChange={handleChange} className={inputClass}>
                  {topics.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className={labelClass}>Sub-Topic</label>
                <input type="text" name="subTopic" value={formData.subTopic} onChange={handleChange} className={inputClass} placeholder="e.g. Analysis, Hollywood..." />
              </div>
            </div>

            <div className="mt-6">
              <label className={labelClass}>Color Accent</label>
              <div className="flex flex-wrap gap-3">
                {presetColors.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, colorHex: color }))}
                    className={`w-10 h-10 rounded-full transition-transform ${formData.colorHex === color ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#0B0C10]' : 'hover:scale-105 opacity-80'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* Step 2: The Persona Engine */}
          <section className="bg-[#0B0C10] border border-gray-800 p-8 rounded-2xl shadow-lg">
            <h3 className="text-xl font-bold text-white mb-6 border-b border-gray-800 pb-4">2. The Persona Engine</h3>
            
            <div className="space-y-6">
              <div>
                <label className={labelClass}>Persona Field (CRITICAL)</label>
                <textarea 
                  required 
                  name="persona" 
                  value={formData.persona} 
                  onChange={handleChange} 
                  className={`${inputClass} font-mono text-sm leading-relaxed`} 
                  rows={15} 
                />
              </div>

              <div>
                <label className={labelClass}>Response Style</label>
                <input 
                  required 
                  type="text" 
                  name="responseStyle" 
                  value={formData.responseStyle} 
                  onChange={handleChange} 
                  className={inputClass} 
                  placeholder="e.g. Short, punchy, Gen-Z slang. Never hedging." 
                />
              </div>
            </div>
          </section>

          {/* Step 3: Data Sources (RSS Feeds) */}
          <section className="bg-[#0B0C10] border border-gray-800 p-8 rounded-2xl shadow-lg">
            <h3 className="text-xl font-bold text-white mb-6 border-b border-gray-800 pb-4 flex justify-between items-center">
              <span>3. Data Sources (RSS Feeds)</span>
              <span className="text-sm font-normal text-gray-500">{formData.rssFeeds.length} / 4 Feeds</span>
            </h3>
            
            <div className="space-y-4">
              {formData.rssFeeds.map((feed, index) => (
                <div key={index} className="flex gap-4 items-start">
                  <div className="flex-1 space-y-3">
                    <input 
                      required 
                      type="text" 
                      placeholder="Feed Name (e.g. ESPN Top Headlines)" 
                      value={feed.name} 
                      onChange={(e) => handleFeedChange(index, 'name', e.target.value)} 
                      className={inputClass} 
                    />
                    <input 
                      required 
                      type="url" 
                      placeholder="Feed URL (e.g. https://www.espn.com/espn/rss/news)" 
                      value={feed.url} 
                      onChange={(e) => handleFeedChange(index, 'url', e.target.value)} 
                      className={inputClass} 
                    />
                  </div>
                  {formData.rssFeeds.length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => removeFeed(index)} 
                      className="mt-3 p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition"
                      title="Remove Feed"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>

            {formData.rssFeeds.length < 4 && (
              <button 
                type="button" 
                onClick={addFeed} 
                className="mt-6 font-bold text-sm text-[#eaff04] hover:underline flex items-center gap-1"
              >
                + Add Another Feed
              </button>
            )}
          </section>

          {/* Submit */}
          <div className="flex justify-end pt-4">
            <button 
              type="submit" 
              disabled={loading}
              className="font-bold transition shadow-[0_4px_14px_rgba(234,255,4,0.15)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer" 
              style={{ backgroundColor: '#eaff04', color: '#000', padding: '1rem 3rem', borderRadius: '0.75rem', fontSize: '16px' }}
            >
              {loading ? 'Creating...' : 'Create Agent'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
