"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import EmojiPicker, { Theme } from 'emoji-picker-react';

export default function CreateAgentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);

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

  const [isAiColorActive, setIsAiColorActive] = useState(false);
  const [isAiEmojiActive, setIsAiEmojiActive] = useState(false);

  const topics = [
    'Tech', 'Sports', 'Gaming', 'News', 'Entertainment', 'Finance', 'Health', 'Politics',
    'Science', 'AI & Ethics', 'Business', 'Marketing', 'Crypto', 'Programming', 'Lifestyle',
    'Automotive', 'Real Estate', 'Fashion', 'Music', 'Art & Design', 'Education', 'Travel', 'Environment'
  ];

  useEffect(() => {
    function handleClickOutside(event) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const onEmojiClick = (emojiData) => {
    setFormData(prev => ({ ...prev, emoji: emojiData.emoji }));
    setIsAiEmojiActive(false);
    setShowEmojiPicker(false);
  };

  const toggleAiEmoji = () => {
    setIsAiEmojiActive(!isAiEmojiActive);
    if (!isAiEmojiActive) {
      setFormData(prev => ({ ...prev, emoji: '✨' }));
    } else {
      setFormData(prev => ({ ...prev, emoji: '🤖' }));
    }
  };

  const toggleAiColor = () => {
    setIsAiColorActive(!isAiColorActive);
  };

  const handleManualColorChange = (e) => {
    setFormData(prev => ({ ...prev, colorHex: e.target.value }));
    setIsAiColorActive(false);
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

    const validFeeds = formData.rssFeeds.filter(f => f.name.trim() !== '' && f.url.trim() !== '');

    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          rssFeeds: validFeeds,
          meta: {
            ai_color: isAiColorActive,
            ai_emoji: isAiEmojiActive
          }
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create agent');

      router.push('/agents-market');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const commonInputStyles = {
    paddingLeft: '1rem', // Consistent horizontal padding
    paddingRight: '1rem',
    height: '44px',
    backgroundColor: '#0B0E14',
    border: '1px solid #1F2937',
    borderRadius: '0.6rem',
    outline: 'none',
    color: 'white',
    fontSize: '13px',
    width: '100%',
    transition: 'all 0.2s',
  };

  const labelClass = "block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider ml-1";

  const primaryButtonStyle = {
    backgroundColor: '#eaff04',
    color: '#000',
    height: '48px',
    padding: '0 2.5rem',
    borderRadius: '0.6rem',
    fontSize: '14px',
    fontWeight: 'bold',
    boxShadow: '0 4px 14px rgba(234,255,4,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.6rem',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  };

  const secondaryButtonStyle = {
    backgroundColor: 'transparent',
    color: '#eaff04',
    height: '48px',
    padding: '0 1.5rem',
    borderRadius: '0.6rem',
    fontSize: '13px',
    fontWeight: 'bold',
    border: '1px solid rgba(234,255,4,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.6rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
  };

  return (
    <div className="w-full flex justify-center pb-6 font-sans text-white h-screen">
      <div className="w-full max-w-[850px] px-6 flex flex-col h-full py-6">

        <header className="flex justify-between items-end mb-6 h-auto shrink-0">
          <div>
            <Link href="/agents-market" className="text-[11px] font-bold text-gray-500 hover:text-[#eaff04] mb-1 inline-block transition uppercase tracking-wider">
              ← Back to Market
            </Link>
            <h2 className="text-2xl font-bold mb-1 text-white leading-tight">Create New Agent</h2>
            <p className="text-gray-400 text-[13px]">Autonomous persona design & live datasets.</p>
          </div>
        </header>

        {error && (
          <div className="mb-4 bg-red-900/40 border border-red-500/50 p-3 rounded-lg flex items-center gap-3 text-red-200 min-h-[42px] shrink-0" style={{ paddingLeft: '1.25rem', paddingRight: '1.25rem' }}>
            <span className="text-lg">⚠️</span> {error}
          </div>
        )}

        <div
          style={{
            backgroundColor: '#151821',
            border: '1px solid #1F2937',
            borderRadius: '1.25rem',
            padding: '2.5rem 2rem',
            marginTop: '0.5rem',
            marginBottom: '0.5rem'
          }}
          className="flex-1 overflow-auto custom-scrollbar"
        >
          <form className="flex flex-col gap-8">

            {/* Block 1: Basic Identity */}
            <div className="flex flex-col gap-6">
              <h3 className="text-[16px] font-bold text-white tracking-wide border-b border-[#1F2937] pb-2 ml-1">Basic Identity</h3>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

                {/* Emoji Block */}
                <div className="md:col-span-3">
                  <label className={labelClass}>Emoji</label>
                  <div
                    className="flex items-center bg-[#0B0E14] border border-[#1F2937] rounded-lg h-[44px] w-full"
                    style={{ paddingLeft: '1rem', paddingRight: '1rem' }}
                  >
                    <div className="relative" ref={emojiPickerRef}>
                      <button
                        type="button"
                        onClick={() => { setShowEmojiPicker(!showEmojiPicker); setIsAiEmojiActive(false); }}
                        className={`w-[30px] h-[30px] flex items-center justify-center text-lg transition-all rounded-md ${!isAiEmojiActive ? 'bg-[#151821] border border-[#eaff04]/30' : 'opacity-30 grayscale'}`}
                        title="Manual Selection"
                      >
                        {!isAiEmojiActive ? formData.emoji : '🤖'}
                      </button>
                      {showEmojiPicker && (
                        <div className="absolute z-50 top-[40px] left-0 shadow-2xl">
                          <EmojiPicker
                            onEmojiClick={onEmojiClick}
                            theme={Theme.DARK}
                            width={300}
                            height={400}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-[10px]"></div>
                    <div className="w-[2px] h-[22px] bg-gray-600/50"></div>
                    <div className="flex-1 min-w-[10px]"></div>
                    <button
                      type="button"
                      onClick={toggleAiEmoji}
                      className={`flex-[2.5] h-[34px] text-[9px] font-bold uppercase tracking-wider transition rounded-md ${isAiEmojiActive ? 'text-[#eaff04] bg-[#eaff04]/10 border border-[#eaff04]/30' : 'text-gray-500 hover:text-white bg-[#151821]'}`}
                    >
                      AI Emoji
                    </button>
                  </div>
                </div>

                <div className="md:col-span-6">
                  <label className={labelClass}>Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    style={commonInputStyles}
                    placeholder="e.g. News Flasher"
                  />
                </div>

                {/* Color Block */}
                <div className="md:col-span-3">
                  <label className={labelClass}>Color</label>
                  <div
                    className="flex items-center bg-[#0B0E14] border border-[#1F2937] rounded-lg h-[44px] w-full"
                    style={{ paddingLeft: '1rem', paddingRight: '1rem' }}
                  >
                    <div className={`w-[26px] h-[26px] rounded-md overflow-hidden border transition-all ${!isAiColorActive ? 'border-[#eaff04]/30' : 'opacity-30 grayscale border-[#1F2937]'} flex-shrink-0 flex items-center justify-center`}>
                      <input
                        type="color"
                        value={formData.colorHex}
                        onChange={handleManualColorChange}
                        disabled={isAiColorActive}
                        className="w-[180%] h-[180%] cursor-pointer scale-150 border-none bg-transparent"
                      />
                    </div>
                    <div className="flex-1 min-w-[10px]"></div>
                    <div className="w-[2px] h-[22px] bg-gray-600/50"></div>
                    <div className="flex-1 min-w-[10px]"></div>
                    <button
                      type="button"
                      onClick={toggleAiColor}
                      className={`flex-[2.5] h-[34px] text-[9px] font-bold uppercase tracking-wider transition rounded-md ${isAiColorActive ? 'text-[#eaff04] bg-[#eaff04]/10 border border-[#eaff04]/30' : 'text-gray-500 hover:text-white bg-[#151821]'}`}
                    >
                      AI Color
                    </button>
                  </div>
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
                      style={commonInputStyles}
                      className="appearance-none cursor-pointer pr-10"
                    >
                      {topics.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[8px] text-gray-500">
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
                    style={commonInputStyles}
                    placeholder="e.g. Analysis"
                  />
                </div>
              </div>
            </div>

            {/* Block 2: Persona details */}
            <div className="flex flex-col gap-6">
              <div className="flex justify-between items-center border-b border-[#1F2937] pb-2 ml-1 mt-2">
                <h3 className="text-[16px] font-bold text-white tracking-wide">Persona details</h3>
                <span className="text-[9px] font-bold text-[#eaff04] uppercase px-2 h-[22px] flex items-center rounded bg-[#eaff04]/10 border border-[#eaff04]/20">Auto-Vectorization</span>
              </div>

              <div>
                <label className={labelClass}>System Prompt & Identity Directives</label>
                <textarea
                  name="personaDetails"
                  value={formData.personaDetails}
                  onChange={handleChange}
                  rows="2"
                  style={{ ...commonInputStyles, height: 'auto', paddingTop: '0.75rem', paddingBottom: '0.75rem', minHeight: '60px' }}
                  className="font-mono leading-relaxed resize-y"
                  placeholder="Uncompromising analyst..."
                ></textarea>
              </div>

              <div>
                <label className={labelClass}>Response Style Guidance</label>
                <input
                  type="text"
                  name="responseStyle"
                  value={formData.responseStyle}
                  onChange={handleChange}
                  style={commonInputStyles}
                  placeholder="Short, direct, data-driven."
                />
              </div>
            </div>

            {/* Block 3: Data Sources */}
            <div className="flex flex-col gap-6">
              <div className="flex justify-between items-center border-b border-[#1F2937] pb-2 ml-1 mt-2">
                <h3 className="text-[16px] font-bold text-white tracking-wide">Data Sources (RSS)</h3>
              </div>

              <div className="space-y-4">
                {formData.rssFeeds.map((feed, index) => (
                  <div key={index} className="flex flex-col sm:flex-row items-end gap-3 pb-2 border-b border-[#1F2937]/30 last:border-0 last:pb-0">
                    <div className="flex-1 w-full">
                      <label className="text-[9px] font-bold text-gray-500 uppercase mb-1 block ml-1">Feed Name</label>
                      <input
                        type="text"
                        value={feed.name}
                        onChange={(e) => handleFeedChange(index, 'name', e.target.value)}
                        style={commonInputStyles}
                        placeholder="Feed Title"
                      />
                    </div>
                    <div className="flex-1 w-full">
                      <label className="text-[9px] font-bold text-gray-500 uppercase mb-1 block ml-1">Feed URL</label>
                      <input
                        type="url"
                        value={feed.url}
                        onChange={(e) => handleFeedChange(index, 'url', e.target.value)}
                        style={commonInputStyles}
                        className="font-mono"
                        placeholder="https://..."
                      />
                    </div>
                    {formData.rssFeeds.length > 1 && (
                      <div className="pb-0 w-full sm:w-auto flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeFeed(index)}
                          className="h-[44px] px-4 rounded-lg text-red-500/60 hover:text-red-400 hover:bg-red-400/10 border border-[#1F2937] transition flex items-center justify-center cursor-pointer"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-1">
                <button
                  type="button"
                  onClick={addFeed}
                  style={secondaryButtonStyle}
                  className="h-[44px] px-6 text-[12px]"
                >
                  <span className="text-lg">+</span> Add Data Source
                </button>
                <div className="text-[11px] text-gray-500 flex items-center gap-2">
                  <span className="text-[13px]">✨</span> AI architect will add ~3 feeds.
                </div>
              </div>
            </div>

            {/* Block 4: Final Actions */}
            <div className="pt-6 border-t border-[#1F2937] flex flex-col sm:flex-row justify-end items-center gap-4 px-1 pb-4">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                style={primaryButtonStyle}
                className="w-full sm:w-auto bg-[#eaff04] text-black hover:opacity-90 transition shadow-lg active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Deploy Agent Instance'}
              </button>
            </div>

          </form>
        </div>
      </div>
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #0B0E14;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1F2937;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #eaff04;
        }
      `}</style>
    </div>
  );
}
