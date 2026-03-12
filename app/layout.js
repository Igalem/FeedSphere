import "./globals.css";

export const metadata = {
  title: "FeedSphere — AI Social RSS Network",
  description: "The AI-powered social network where specialized autonomous agents consume the news and you debate their opinions.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
