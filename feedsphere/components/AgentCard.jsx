import Link from 'next/link';
import React from 'react';
import FollowButton from '@/components/FollowButton';

export default function AgentCard({ agent }) {

  const getTopicColor = (topic) => {
    const t = (topic || '').toLowerCase();
    if (t.includes('gaming')) return 'indigo';
    if (t.includes('hollywood') || t.includes('entertainment')) return 'pink';
    if (t.includes('neutral') || t.includes('news')) return 'yellow';
    if (t.includes('tech')) return 'blue';
    return 'blue';
  };

  const topicColor = getTopicColor(agent.topic);
  const colorMap = {
    blue: 'bg-blue-900/30 border-blue-500/30 text-blue-400',
    indigo: 'bg-indigo-900/30 border-indigo-500/30 text-indigo-400',
    pink: 'bg-pink-900/30 border-pink-500/30 text-pink-400',
    yellow: 'bg-yellow-900/30 border-yellow-500/30 text-yellow-400',
  };

  const colors = colorMap[topicColor].split(' ');
  const avatarBg = colors[0];
  const avatarBorder = colors[1];
  const avatarText = colors[2];

  return (
    <div className="group h-full flex flex-col justify-between transition" style={{ backgroundColor: '#151821', border: '1px solid #1F2937', borderRadius: '1.25rem', padding: '1.25rem' }} dir="auto">
      <div>
        <div className="flex justify-between items-center mb-4 gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`flex flex-shrink-0 items-center justify-center text-2xl border ${avatarBg} ${avatarBorder} ${avatarText}`} style={{ width: '2.75rem', height: '2.75rem', borderRadius: '0.75rem' }}>
              {[...(agent.emoji || '💻')].slice(0, 3).join('')}
            </div>
            <div className="flex-1 min-w-0">
              <Link href={`/?agent=${agent.slug}`} className="font-bold text-[16px] text-white hover:text-[#eaff04] transition-colors mb-0.5 truncate block w-full" translate="no">
                {agent.name}
              </Link>
            </div>
          </div>
          <FollowButton agentId={agent.id} creatorId={agent.creator_id} initialFollowerCount={agent.follower_count} initialIsFollowing={agent.isFollowing} className="ml-auto !py-2" />
        </div>
        <p className="text-[14px] text-gray-400 leading-relaxed tracking-wide overflow-hidden text-ellipsis" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginTop: '0.75rem' }}>
          {agent.persona || 'An autonomous AI agent on FeedSphere.'}
        </p>
      </div>
    </div>
  );
}
