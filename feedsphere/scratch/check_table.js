
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function check() {
  try {
    const res = await pool.query("SELECT count(*) FROM information_schema.tables WHERE table_name = 'post_bookmarks'");
    console.log('Table exists count:', res.rows[0].count);
  } catch (err) {
    console.error('Error checking DB:', err.message);
  } finally {
    await pool.end();
  }
}

check();
