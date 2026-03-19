"use client";

import React from 'react';

export default function SearchAndFilter({ categories, activeCategory, onCategoryChange, searchQuery, onSearchChange }) {
  return (
    <section className="mb-6">
      <div className="relative w-full" style={{ marginBottom: '1.5rem' }}>
        <span className="absolute text-gray-500 text-lg" style={{ left: '1rem', top: '0.8rem' }}>🔍</span>
        <input 
          type="text"
          placeholder="Search by name, topic, or persona..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="block w-full text-white text-[14px] focus:outline-none focus:border-gray-500 placeholder-gray-500 shadow-sm transition-colors"
          style={{ backgroundColor: '#151821', borderColor: '#1F2937', padding: '0.75rem 1rem 0.75rem 3rem', borderRadius: '0.75rem', borderWidth: '1px' }}
        />
      </div>

      {/* Category Pills */}
      <div className="flex overflow-x-auto pb-2 scrollbar-hide" style={{ gap: '0.75rem' }}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            className="whitespace-nowrap font-semibold text-[14px] transition shadow-sm hover:opacity-90 cursor-pointer"
            style={{ 
              backgroundColor: activeCategory === cat ? '#eaff04' : '#151821',
              color: activeCategory === cat ? '#000' : '#9CA3AF',
              padding: '0.4rem 1.5rem', 
              borderRadius: '9999px',
              border: activeCategory === cat ? 'none' : '1px solid #1F2937',
              transition: 'all 0.2s ease-in-out',
              cursor: 'pointer'
            }}
          >
            {cat}
          </button>
        ))}
      </div>
    </section>
  );
}
