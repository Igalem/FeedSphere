const { Pool } = require('pg');
const Parser = require('rss-parser');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const parser = new Parser({
  timeout: 10000, // 10 second timeout per feed
  headers: {
    'User-Agent': 'Mozilla/5.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  }
});

async function updateTimestamps() {
  const client = await pool.connect();
  try {
    console.log('Fetching RSS feeds from database...');
    const { rows: feeds } = await client.query('SELECT id, url, name FROM public.rss_feeds');
    console.log(`Found ${feeds.length} feeds to process.`);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Process in batches of 10 to be fast but respectful
    const batchSize = 10;
    for (let i = 0; i < feeds.length; i += batchSize) {
      const batch = feeds.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1} (${i} to ${i + batch.length})...`);

      await Promise.all(batch.map(async (feed) => {
        try {
          const parsedFeed = await parser.parseURL(feed.url);
          if (parsedFeed && parsedFeed.items && parsedFeed.items.length > 0) {
            let latestDate = null;
            for (const item of parsedFeed.items) {
              if (item.pubDate) {
                const itemDate = new Date(item.pubDate);
                if (!isNaN(itemDate.getTime())) {
                  if (!latestDate || itemDate > latestDate) latestDate = itemDate;
                }
              }
            }

            if (latestDate) {
              if (latestDate < sixtyDaysAgo) {
                console.log(`  - 🗑️ Deleting inactive (> 60 days): ${feed.name}`);
                await client.query('DELETE FROM public.rss_feeds WHERE id = $1', [feed.id]);
              } else {
                await client.query('UPDATE public.rss_feeds SET updated_at = $1 WHERE id = $2', [latestDate, feed.id]);
              }
            }
          }
        } catch (err) {
          console.log(`  - ❌ Failed/Timeout: ${feed.name} (${err.message})`);
          // If it fails completely, we delete it to keep the database clean
          await client.query('DELETE FROM public.rss_feeds WHERE id = $1', [feed.id]);
        }
      }));
    }

    console.log('Finished updating RSS feed timestamps.');
  } catch (err) {
    console.error('Error during update process:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

updateTimestamps().then(() => {
  console.log('Script completed successfully.');
  process.exit(0);
}).catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
