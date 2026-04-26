const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const Parser = require('rss-parser');

const __dirname_local = __dirname;
// Base directory of the project
const baseDir = path.resolve(__dirname_local, '../../../../feedsphere');
dotenv.config({ path: path.join(baseDir, '.env.local') });

// Dynamically load the DB module (which might be ESM or CJS)
// Since we are CJS, if lib/db.js is ESM, this might be tricky,
// but lib/db.js uses 'export const db', so it's probably ESM if the environment supports it.
// However, scrape-rss.js uses require('pg'), so let's check lib/db.js again.
// lib/db.js uses 'import { Pool } from "pg"'.
// Wait, if lib/db.js is ESM and we are CJS, we need dynamic import.

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  }
});

async function checkAndAddFeeds(feedList, deltaDays = 15) {
  const { db } = await import(path.join(baseDir, 'lib/db.js'));
  const targetDeltaDate = new Date();
  targetDeltaDate.setDate(targetDeltaDate.getDate() - deltaDays);

  console.log(`Processing ${feedList.length} candidate feeds...`);
  console.log(`Verification Window: Last ${deltaDays} days (since ${targetDeltaDate.toISOString()})`);

  for (const feed of feedList) {
    try {
      console.log(`Checking: ${feed.name} (${feed.url})...`);
      const feedResult = await parser.parseURL(feed.url);

      const latestItem = feedResult.items[0];
      if (!latestItem) {
        console.warn(`No items found for ${feed.name}`);
        continue;
      }

      const pubDateStr = latestItem.isoDate || latestItem.pubDate || latestItem.updated;
      if (!pubDateStr) {
        console.warn(`No publication date for latest item in ${feed.name}`);
        continue;
      }

      const pubDate = new Date(pubDateStr);
      if (pubDate >= targetDeltaDate) {
        console.log(`✅ ${feed.name} is up to date (Latest item: ${pubDate.toISOString()}). Adding to database...`);

        // Remove sub_topic as it's no longer in the schema
        const { sub_topic, ...sanitizedFeed } = feed;

        // Extract domain from URL if missing
        if (!sanitizedFeed.domain && sanitizedFeed.url) {
          try {
            sanitizedFeed.domain = new URL(sanitizedFeed.url).hostname;
          } catch (e) {
            console.warn(`⚠️ Could not parse domain for ${sanitizedFeed.url}`);
          }
        }

        // Sanitize name: remove content after common separators (—, :, |, etc)
        if (sanitizedFeed.name) {
          sanitizedFeed.name = sanitizedFeed.name.split(/ [—–:\|>!]/)[0].trim();
          sanitizedFeed.name = sanitizedFeed.name.replace(/^Articles on /, '');
          // If name is just a URL/domain, keep it, but ensure it's not a full http string if possible
        }

        const { error } = await db.from('rss_feeds').upsert(sanitizedFeed, 'url');
        if (error) {
          console.error(`❌ Error inserting ${feed.name}:`, error.message);
        } else {
          console.log(`🚀 ${sanitizedFeed.name} added!`);
        }
      } else {
        console.log(`⏭️ ${feed.name} is too old (Latest item: ${pubDate.toISOString()}).`);
      }
    } catch (err) {
      console.error(`❌ Error parsing ${feed.name}:`, err.message);
    }
  }
}

if (require.main === module) {
  const filePath = process.argv[2];
  const deltaDays = parseInt(process.argv[3]) || 15;

  if (!filePath) {
    console.error('Usage: node add_feeds.js [FEED_LIST_JSON_FILE] [DELTA_DAYS]');
    process.exit(1);
  }

  (async () => {
    try {
      const rawData = fs.readFileSync(filePath);
      const feedList = JSON.parse(rawData);
      await checkAndAddFeeds(feedList, deltaDays);

      console.log('\n📸 Updating seed SQL snapshot...');
      try {
        const { execSync } = require('child_process');
        const dumpScript = path.join(baseDir, 'scripts/dump_seed_feeds.js');
        execSync(`export NODE_PATH=${baseDir}/node_modules && /usr/local/bin/node ${dumpScript}`, {
          cwd: baseDir,
          env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
          stdio: 'inherit'
        });
      } catch (e) {
        console.warn('⚠️ Could not update seed SQL snapshot:', e.message);
      }

      process.exit(0);
    } catch (err) {
      console.error('Error reading or parsing feed list file:', err.message);
      process.exit(1);
    }
  })();
}

module.exports = { checkAndAddFeeds };
