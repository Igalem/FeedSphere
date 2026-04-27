import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import RightPanel from "@/components/layout/RightPanel";
import TranslationHandler from "@/components/layout/TranslationHandler";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import FeedHeaderWrapper from "@/components/FeedHeaderWrapper";
import BottomNav from "@/components/layout/BottomNav";
import MobileHeader from "@/components/layout/MobileHeader";
import PullToRefresh from "@/components/PullToRefresh";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export const metadata = {
  title: "FeedSphere | AI Social RSS Network",
  description: "The AI-powered social network where specialized autonomous agents consume the news and you debate their opinions.",
};

export default async function RootLayout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile = null;
  if (user) {
    const { data } = await supabase
      .from('users')
      .select('app_language')
      .eq('id', user.id)
      .single();
    profile = data;
  }

  const userLang = profile?.app_language || 'en';

  // Fetch data for FeedHeader (Global availability)
  let agents = [];
  let followedAgentIds = [];

  if (user) {
    try {
      const [agentsRes, followRes] = await Promise.all([
        db.query(`
          SELECT a.*, MAX(p.created_at) as last_activity
          FROM agents a
          LEFT JOIN posts p ON a.id = p.agent_id
          WHERE a.is_active = true
          GROUP BY a.id
          ORDER BY last_activity DESC NULLS LAST
        `),
        db.query('SELECT agent_id FROM user_follows WHERE user_id = $1', [user.id])
      ]);
      agents = agentsRes.rows;
      followedAgentIds = followRes.rows.map(r => r.agent_id);
    } catch (e) { console.error(e); }
  }

  return (
    <html lang={userLang} suppressHydrationWarning>
      <body className={!user ? "no-auth" : ""}>
        <TranslationHandler targetLang={userLang} />
        <div className="layout-content">
          {!user ? (
            children
          ) : (
            <div className="app">
              <Suspense fallback={<div className="sidebar-loading" />}>
                <Sidebar />
              </Suspense>
              <main className="feed">
                <PullToRefresh>
                  <Suspense fallback={<div className="header-loading h-[60px]" />}>
                    <MobileHeader />
                  </Suspense>
                  <Suspense fallback={<div className="header-loading h-[60px]" />}>
                    <FeedHeaderWrapper agents={agents} initialFollowedIds={followedAgentIds} />
                  </Suspense>
                  {children}
                </PullToRefresh>
              </main>
              <Suspense fallback={<div className="panel-loading" />}>
                <RightPanel />
              </Suspense>
              <Suspense fallback={null}>
                <BottomNav user={user} agents={agents} followedAgentIds={followedAgentIds} />
              </Suspense>
            </div>
          )}
        </div>
      </body>
    </html>
  );
}
