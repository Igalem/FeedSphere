
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Base directory of the project
const baseDir = path.resolve(__dirname, '../../../../feedsphere');
dotenv.config({ path: path.join(baseDir, '.env.local') });

import Parser from 'rss-parser';
const { db } = await import(path.join(baseDir, 'lib/db.js'));

const parser = new Parser();

async function checkAndAddFeeds(feedList) {
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
  
  const twentyDaysAgo = new Date();
  twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);

  console.log(`Processing ${feedList.length} candidate feeds...`);
  
  for (const feed of feedList) {
    const isHealth = (feed.topic === 'health' || feed.category === 'health');
    const targetDeltaDate = isHealth ? twentyDaysAgo : fiveDaysAgo;
    
    try {
      console.log(`Checking: ${feed.name} (${feed.url})... (Delta: ${isHealth ? 20 : 5} days)`);
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

// Export for manual usage or run directly if needed
export { checkAndAddFeeds };
