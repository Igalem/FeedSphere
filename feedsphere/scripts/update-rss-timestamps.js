const { Pool } = require('pg');
const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

// Parse .env.local manually if DATABASE_URL is not in environment
if (!process.env.DATABASE_URL) {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const [k, ...v] = line.split('=');
      if (k && v.length) process.env[k.trim()] = v.join('=').trim();
    }
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const parser = new Parser();

async function updateTimestamps() {
  const client = await pool.connect();
  try {
    console.log('Fetching RSS feeds from database...');
    // Fetch all to check for inactivity (> 6 days)
    const { rows: feeds } = await client.query('SELECT id, url, name FROM public.rss_feeds');
    console.log(`Found ${feeds.length} feeds to process.`);

    const sixDaysAgo = new Date();
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);

    for (const feed of feeds) {
      console.log(`Processing feed: ${feed.name} (${feed.url})...`);
      try {
        const parsedFeed = await parser.parseURL(feed.url);
        if (parsedFeed && parsedFeed.items && parsedFeed.items.length > 0) {
          // Get the latest item's pubDate
          // Most feeds are ordered by date, so the first item is the latest.
          // However, we should check if pubDate exists and parse it.
          let latestDate = null;

          for (const item of parsedFeed.items) {
            if (item.pubDate) {
              const itemDate = new Date(item.pubDate);
              if (!isNaN(itemDate.getTime())) {
                if (!latestDate || itemDate > latestDate) {
                  latestDate = itemDate;
                }
              }
            }
          }

          if (latestDate) {
            console.log(`  - Latest update found: ${latestDate.toISOString()}`);
            
            if (latestDate < sixDaysAgo) {
              console.log(`  - 🗑️ DELETING inactive feed (latest post > 6 days ago): ${feed.name}`);
              await client.query('DELETE FROM public.rss_feeds WHERE id = $1', [feed.id]);
            } else {
              await client.query(
                'UPDATE public.rss_feeds SET updated_at = $1 WHERE id = $2',
                [latestDate, feed.id]
              );
            }
          } else {
            console.log(`  - No valid pubDate found in items for ${feed.name}.`);
          }
        } else {
          console.log(`  - No items found for ${feed.name}.`);
        }
      } catch (feedError) {
        console.error(`  - Error fetching/parsing feed ${feed.url}:`, feedError.message);
        console.log(`  - 🗑️ DELETING broken feed: ${feed.name}`);
        try {
          await client.query('DELETE FROM public.rss_feeds WHERE id = $1', [feed.id]);
        } catch (delError) {
          console.error(`  - Failed to delete feed ${feed.id}:`, delError.message);
        }
      }
    
      // Small delay to avoid hitting feeds too hard (optional)
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log('Finished updating RSS feed timestamps.');
  } catch (err) {
    console.error('Error during update process:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

updateTimestamps().catch(err => {
  console.error('Fatal error in script:', err);
  process.exit(1);
});
