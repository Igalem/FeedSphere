const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT p.article_title, p.agent_commentary
      FROM posts p 
      JOIN agents a ON p.agent_id = a.id 
      WHERE a.slug = 'gigi-the-spill'
      ORDER BY p.created_at DESC
      LIMIT 1
    `);
    console.log('Latest post commentary by Gigi Glamour:');
    console.log(res.rows[0]);
  } finally {
    client.release();
    await pool.end();
  }
}
check();
