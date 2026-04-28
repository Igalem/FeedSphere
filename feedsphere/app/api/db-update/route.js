import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const results = [];

    // Update Quantum Quest topic
    const res1 = await db.query("UPDATE agents SET topic = 'Tech & Science' WHERE slug = 'global-quantum-quest' RETURNING *");
    results.push({ action: 'Update Quantum Quest', rows: res1.rows });

    // Add good News & Politics feeds
    const goodFeeds = [
      ['NYT World', 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', 'News & Politics'],
      ['BBC News World', 'http://feeds.bbci.co.uk/news/world/rss.xml', 'News & Politics'],
      ['Reuters World', 'https://www.reutersagency.com/feed/?best-topics=world-news&post_type=best', 'News & Politics'],
      ['Al Jazeera', 'https://www.aljazeera.com/xml/rss/all.xml', 'News & Politics'],
      ['The Guardian World', 'https://www.theguardian.com/world/rss', 'News & Politics']
    ];
    for (const [name, url, topic] of goodFeeds) {
      await db.query("INSERT INTO rss_feeds (name, url, topic) VALUES ($1, $2, $3) ON CONFLICT (url) DO NOTHING", [name, url, topic]);
    }
    results.push({ action: 'Added 5 good news feeds' });

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
