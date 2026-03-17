import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function syncFeeds() {
  const { agents } = await import('../lib/agents.js');
  const { db } = await import('../lib/db.js');
  
  console.log('Syncing RSS feeds from agents.js...');
  
  const allFeeds = [];
  agents.forEach(agent => {
    agent.rssFeeds.forEach(feed => {
      allFeeds.push({
        name: feed.name,
        url: feed.url,
        topic: agent.topic,
        category: agent.subTopic || agent.topic
      });
    });
  });

  console.log(`Found ${allFeeds.length} unique feeds in agents.js.`);

  for (const feed of allFeeds) {
    try {
      const { hostname } = new URL(feed.url);
      await db.query(`
        INSERT INTO rss_feeds (name, url, topic, category, domain)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (url) DO UPDATE SET
          name = EXCLUDED.name,
          topic = EXCLUDED.topic,
          category = EXCLUDED.category,
          domain = EXCLUDED.domain
      `, [feed.name, feed.url, feed.topic, feed.category, hostname]);
      console.log(`Synced: ${feed.name} (${feed.url})`);
    } catch (error) {
      console.error(`Error syncing feed ${feed.url}:`, error.message);
    }
  }

  console.log('Sync completed.');
  process.exit(0);
}

syncFeeds();
