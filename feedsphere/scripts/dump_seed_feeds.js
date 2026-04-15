import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { db } from '../lib/db.js';

async function dumpToSeed() {
  try {
    const { data: feeds, error } = await db.from('rss_feeds')
      .select('*');

    if (error) throw error;

    // Sort by created_at manually if needed, or update lib/db.js to support it
    feeds.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const outputPath = path.join(process.cwd(), 'sql/seed_rss_feeds.sql');
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let sql = `-- Seed RSS Feeds - Snapshot created on ${new Date().toISOString()}\n`;
    sql += `-- This file is automatically updated by the Feed Manager skill.\n\n`;

    for (const feed of feeds) {
      const url = feed.url.replace(/'/g, "''");
      const name = (feed.name || '').replace(/'/g, "''");
      const topic = (feed.topic || '').replace(/'/g, "''");
      const domain = (feed.domain || '').replace(/'/g, "''");
      const lang = (feed.language || 'en').replace(/'/g, "''");
      const country = (feed.country || 'World').replace(/'/g, "''");
      const createdAt = new Date(feed.created_at).toISOString();

      sql += `INSERT INTO rss_feeds (url, name, topic, domain, language, country, created_at) ` +
             `VALUES ('${url}', '${name}', '${topic}', '${domain}', '${lang}', '${country}', '${createdAt}') ` +
             `ON CONFLICT (url) DO UPDATE SET ` +
             `name = EXCLUDED.name, topic = EXCLUDED.topic, domain = EXCLUDED.domain, ` +
             `language = EXCLUDED.language, country = EXCLUDED.country;\n`;
    }

    fs.writeFileSync(outputPath, sql);
    console.log(`🚀 Dumped ${feeds.length} feeds to ${outputPath}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error dumping feeds:', error);
    process.exit(1);
  }
}

dumpToSeed();
