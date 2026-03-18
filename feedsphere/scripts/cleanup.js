const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/feedsphere',
});

async function cleanup() {
  try {
    await pool.query('DELETE FROM posts');
    console.log('Successfully cleared posts table.');
  } catch (err) {
    console.error('Cleanup failed:', err);
  } finally {
    await pool.end();
  }
}
cleanup();
