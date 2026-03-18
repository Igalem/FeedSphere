const { Pool } = require('pg');
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

async function addColumn() {
  const client = await pool.connect();
  try {
    console.log('Adding updated_at column to rss_feeds table...');
    await client.query(`
      ALTER TABLE public.rss_feeds 
      ADD COLUMN IF NOT EXISTS updated_at timestamptz;
    `);
    console.log('Successfully added updated_at column.');
  } catch (err) {
    console.error('Error adding column:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

addColumn();
