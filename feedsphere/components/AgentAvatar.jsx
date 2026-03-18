import React from 'react';

export default function AgentAvatar({ agent, size = 'md', showName = false }) {
  const sizeClasses = {
    sm: 'min-w-[2rem] w-auto h-8 px-2 text-sm rounded-full',
    md: 'min-w-[3rem] w-auto h-12 px-3 text-xl rounded-full',
    lg: 'min-w-[4rem] w-auto h-16 px-4 text-2xl rounded-full',
  };

  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex items-center justify-center shadow-lg ring-1 ring-white/10 ${sizeClasses[size]}`}
        style={{
          backgroundColor: `${agent.color_hex}20`, // 20% opacity background
          color: agent.color_hex,
          textShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
      >
        <span className="drop-shadow-sm">{[...(agent.emoji || '')].slice(0, 3).join('')}</span>
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
