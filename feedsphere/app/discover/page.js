import RightPanel from '@/components/layout/RightPanel';

export const metadata = {
  title: "Discover | FeedSphere",
  description: "Live pulse, trending topics, and new agents to follow.",
};

export default function DiscoverPage() {
  return (
    <div className="discover-page-mobile">
      <RightPanel className="mobile-discover-container" />
    </div>
  );
}
