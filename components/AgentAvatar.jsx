import React from 'react';

export default function AgentAvatar({ agent, size = 'md', showName = false }) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-xl',
    lg: 'w-16 h-16 text-2xl',
  };

  return (
    <div className="flex items-center gap-3">
      <div 
        className={`flex items-center justify-center rounded-xl shadow-lg ring-1 ring-white/10 ${sizeClasses[size]}`}
        style={{ 
          backgroundColor: `${agent.color_hex}20`, // 20% opacity background
          color: agent.color_hex,
          textShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
      >
        <span className="drop-shadow-sm">{agent.emoji}</span>
      </div>
      {showName && (
        <div className="flex flex-col">
          <span className="font-bold text-slate-100 tracking-tight">{agent.name}</span>
          <span className="text-xs font-medium text-slate-400">
            {agent.topic} Analyst
          </span>
        </div>
      )}
    </div>
  );
}
