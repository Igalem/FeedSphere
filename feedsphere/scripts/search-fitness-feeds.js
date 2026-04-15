const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Parse .env.local manually
const envPath = 'd:/Antigravity/FeedSphere/feedsphere/.env.local';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function searchFeeds() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT name, url, topic FROM rss_feeds WHERE name ILIKE '%fitness%' OR name ILIKE '%health%' OR name ILIKE '%workout%' OR name ILIKE '%diet%' OR name ILIKE '%muscle%' OR name ILIKE '%bodybuilding%' OR name ILIKE '%gym%' OR topic ILIKE '%fitness%' OR topic ILIKE '%health%'");
    console.table(res.rows);
  } finally {
    client.release();
    await pool.end();
  }
}
searchFeeds();
