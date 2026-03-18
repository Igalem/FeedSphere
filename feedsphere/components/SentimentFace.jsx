import React from 'react';

export default function SentimentFace({ score, color, size = 18, strokeWidth = 1.8, showLabel = false }) {
  // Determine mouth path based on score
  let mouthPath = "M8 15h8"; // Neutral
  let label = "Neutral";

  if (score > 85) {
    mouthPath = "M7 13s2 4 5 4 5-4 5-4"; // Very Happy
    label = "Bullish";
  } else if (score > 65) {
    mouthPath = "M8 14s1.5 3 4 3 4-3 4-3"; // Happy
    label = "Positive";
  } else if (score > 40) {
    mouthPath = "M8 15h8"; // Neutral
    label = "Neutral";
  } else if (score > 20) {
    mouthPath = "M8 16s1.5-2 4-2 4 2 4 2"; // Sad
    label = "Skeptical";
  } else {
    mouthPath = "M7 17s2-4 5-4 5 4 5 4"; // Very Sad
    label = "Critical";
  }

  return (
    <div className="sentiment-display" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke={color} 
        strokeWidth={strokeWidth} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        style={{ 
          transition: 'all 0.3s ease',
          display: 'block'
        }}
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M8 9h.01" strokeWidth={strokeWidth + 0.5} />
        <path d="M16 9h.01" strokeWidth={strokeWidth + 0.5} />
        <path d={mouthPath} />
      </svg>
      {showLabel && (
        <span translate="no" style={{ color: color, fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {label}
        </span>
      )}
    </div>
  );
}
