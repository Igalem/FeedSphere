const { Pool } = require('pg');
const Parser = require('rss-parser');
const dotenv = require('dotenv');
const path = require('path');
const { execSync } = require('child_process');

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  }
});

async function cleanup() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT name, url FROM rss_feeds');
    const feeds = res.rows;
    console.log(`Checking ${feeds.length} feeds for activity...`);

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const deadFeeds = [];

    for (const feed of feeds) {
      try {
        console.log(`Checking: ${feed.name} (${feed.url})...`);
        const feedResult = await parser.parseURL(feed.url);
        
        if (!feedResult.items || feedResult.items.length === 0) {
          console.log(`❌ No items found for ${feed.name}. Marking as dead.`);
          deadFeeds.push(feed.url);
          continue;
        }

        const latestItem = feedResult.items[0];
        const pubDateStr = latestItem.isoDate || latestItem.pubDate || latestItem.updated;
        
        if (!pubDateStr) {
          console.log(`⚠️ No date found for latest item in ${feed.name}. Skipping for safety.`);
          continue;
        }

        const pubDate = new Date(pubDateStr);
        if (pubDate < oneYearAgo) {
          console.log(`❌ ${feed.name} is DEAD (Latest item: ${pubDate.toISOString()}, older than 1 year).`);
          deadFeeds.push(feed.url);
        } else {
          console.log(`✅ ${feed.name} is active (Latest item: ${pubDate.toISOString()}).`);
        }
      } catch (err) {
        console.error(`⚠️ Error parsing ${feed.name}: ${err.message}. Skipping.`);
        // We only delete if we are SURE it's older than 1 year or empty. 
        // Failing to parse might be a temporary network issue.
      }
    }

    if (deadFeeds.length > 0) {
      console.log(`\nDeleting ${deadFeeds.length} dead feeds from database...`);
      for (const url of deadFeeds) {
        await client.query('DELETE FROM rss_feeds WHERE url = $1', [url]);
      }
      console.log('Deletion complete.');

      console.log('\n📸 Updating seed SQL snapshot...');
      const dumpScript = path.join(__dirname, 'dump_seed_feeds.js');
      try {
        execSync(`node ${dumpScript}`, {
          cwd: path.join(__dirname, '..'),
          env: { ...process.env },
          stdio: 'inherit'
        });
        console.log('Seed SQL updated successfully.');
      } catch (e) {
        console.error('❌ Failed to update seed SQL snapshot:', e.message);
      }
    } else {
      console.log('\nNo dead feeds found.');
    }

  } catch (err) {
    console.error('Cleanup failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanup();
