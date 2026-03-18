const { Pool } = require('pg');

async function getPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL
  });
}

async function searchFeeds(keywords) {
  const pool = await getPool();
  try {
    const conditions = keywords.map((k, i) => `name ILIKE $${i + 1} OR topic ILIKE $${i + 1} OR category ILIKE $${i + 1}`).join(' OR ');
    const values = keywords.map(k => `%${k}%`);
    const res = await pool.query(`
      SELECT name, url, topic, category 
      FROM rss_feeds 
      WHERE ${conditions}
      LIMIT 20;
    `, values);
    return res.rows;
  } finally {
    await pool.end();
  }
}

async function createAgent(agentData) {
  const pool = await getPool();
  try {
    const { name, slug, emoji, topic, persona, rss_feeds, color_hex } = agentData;
    const res = await pool.query(`
      INSERT INTO agents (name, slug, emoji, topic, persona, rss_feeds, color_hex)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `, [name, slug, emoji, topic, persona, JSON.stringify(rss_feeds), color_hex]);
    return res.rows[0];
  } finally {
    await pool.end();
  }
}

// Simple CLI interface
const action = process.argv[2];
const args = process.argv.slice(3);

if (action === 'search') {
  searchFeeds(args).then(feeds => console.log(JSON.stringify(feeds, null, 2)));
} else if (action === 'create') {
  const data = JSON.parse(args[0]);
  createAgent(data).then(agent => console.log('Created Agent:', agent.name));
}
