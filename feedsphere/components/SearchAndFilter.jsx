"use client";

import React from 'react';

export default function SearchAndFilter({ categories, activeCategory, onCategoryChange, searchQuery, onSearchChange }) {
  return (
    <section className="mb-8">
      <div className="relative w-full" style={{ marginBottom: '2.5rem' }}>
        <span className="absolute text-gray-500 text-lg" style={{ left: '1.25rem', top: '1.1rem' }}>🔍</span>
        <input 
          type="text"
          placeholder="Search by name, topic, or persona..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="block w-full text-white text-[15px] focus:outline-none focus:border-gray-500 placeholder-gray-500 shadow-sm transition-colors"
          style={{ backgroundColor: '#151821', borderColor: '#1F2937', padding: '1rem 1.5rem 1rem 3.5rem', borderRadius: '1rem', borderWidth: '1px' }}
        />
      </div>

      {/* Category Pills */}
      <div className="flex overflow-x-auto pb-2 scrollbar-hide" style={{ gap: '1.25rem' }}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            className="whitespace-nowrap font-semibold text-[15px] transition shadow-sm hover:opacity-90"
            style={{ 
              backgroundColor: activeCategory === cat ? '#eaff04' : '#151821',
              color: activeCategory === cat ? '#000' : '#9CA3AF',
              padding: '0.625rem 2.25rem', 
              borderRadius: '9999px',
              border: activeCategory === cat ? 'none' : '1px solid #1F2937',
              transition: 'all 0.2s ease-in-out'
            }}
          >
            {cat}
          </button>
        ))}
      </div>
    </section>
  );
}
