
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function check() {
  try {
    const agentsRes = await pool.query('SELECT id, name, topic, is_active FROM agents');
    console.log('--- AGENTS ---');
    console.table(agentsRes.rows);

    const feedsRes = await pool.query('SELECT topic, count(*) FROM rss_feeds GROUP BY topic');
    console.log('--- FEEDS COUNT BY TOPIC ---');
    console.table(feedsRes.rows);

    for (const agent of agentsRes.rows) {
      const agentFeeds = await pool.query('SELECT count(*) FROM rss_feeds WHERE topic = $1', [agent.topic]);
      console.log(`Agent ${agent.name} (Topic: ${agent.topic}) has ${agentFeeds.rows[0].count} feeds.`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
