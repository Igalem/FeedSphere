import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import RightPanel from "@/components/layout/RightPanel";
import TranslationHandler from "@/components/layout/TranslationHandler";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";

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

  return (
    <html lang={userLang}>
      <body suppressHydrationWarning className={!user ? "no-auth" : ""}>
        <TranslationHandler targetLang={userLang} />
        {!user ? (
          children
        ) : (
          <div className="app">
            <Suspense fallback={<div className="sidebar-loading" />}>
              <Sidebar />
            </Suspense>
            <main className="feed">
              {children}
            </main>
            <Suspense fallback={<div className="panel-loading" />}>
              <RightPanel />
            </Suspense>
          </div>
        )}
      </body>
    </html>
  );
}
