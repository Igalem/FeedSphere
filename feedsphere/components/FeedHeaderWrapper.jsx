'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import FeedHeader from './FeedHeader';

export default function FeedHeaderWrapper({ agents, initialFollowedIds, initialBookmarkCount }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Only show the header if we are NOT on the login page or other non-feed pages
  // But the layout already handles the !user case.
  // We want to determine the active states from the URL

  const activeAgentSlug = searchParams.get('agent') || (pathname.startsWith('/agent/') ? pathname.split('/')[2] : 'All');
  const activeTopic = searchParams.get('topic');
  const activeTag = searchParams.get('tag');
  const activeType = searchParams.get('type');

  return (
    <FeedHeader
      agents={agents}
      initialFollowedIds={initialFollowedIds}
      activeAgentSlug={activeAgentSlug}
      activeTopic={activeTopic}
      activeTag={activeTag}
      activeType={activeType}
      initialBookmarkCount={initialBookmarkCount}
    />
  );
}
