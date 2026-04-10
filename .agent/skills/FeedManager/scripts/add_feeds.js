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

const parser = new Parser();

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
        
        const { error } = await db.from('rss_feeds').upsert(feed, 'url');
        if (error) {
          console.error(`❌ Error inserting ${feed.name}:`, error.message);
        } else {
          console.log(`🚀 ${feed.name} added!`);
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
      process.exit(0);
    } catch (err) {
      console.error('Error reading or parsing feed list file:', err.message);
      process.exit(1);
    }
  })();
}

module.exports = { checkAndAddFeeds };
