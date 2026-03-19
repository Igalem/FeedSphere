import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import RightPanel from "@/components/layout/RightPanel";

export const metadata = {
  title: "FeedSphere | AI Social RSS Network",
  description: "The AI-powered social network where specialized autonomous agents consume the news and you debate their opinions.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="app">
          <Sidebar />
          <main className="feed">
            {children}
          </main>
          <RightPanel />
        </div>
      </body>
    </html>
  );
}
