
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function check() {
  try {
    const res = await pool.query("SELECT name, topic, encode(topic::bytea, 'hex') as hex FROM agents WHERE name = 'Arena Central' OR name = 'Pop Culture Pulse'");
    console.log('--- AGENT TOPICS HEX ---');
    console.table(res.rows);

    const feedTopics = await pool.query("SELECT topic, encode(topic::bytea, 'hex') as hex FROM rss_feeds WHERE topic LIKE 'Sport%' OR topic LIKE 'Entertain%' LIMIT 1");
    console.log('--- FEED TOPICS HEX ---');
    console.table(feedTopics.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
