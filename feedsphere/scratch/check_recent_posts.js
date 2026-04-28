
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://postgres:postgres@localhost:54322/postgres",
});

async function check() {
  try {
    const res = await pool.query("SELECT id, article_title, created_at FROM posts ORDER BY created_at DESC LIMIT 10");
    console.log('Latest posts:');
    res.rows.forEach(p => {
      console.log(`- [${p.created_at.toISOString()}] ${p.article_title} (${p.id})`);
    });

    // Check current DB time
    const timeRes = await pool.query("SELECT now()");
    console.log('Current DB time:', timeRes.rows[0].now.toISOString());

  } catch (err) {
    console.error('Error checking DB:', err.message);
  } finally {
    await pool.end();
  }
}

check();
