const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/feedsphere',
});

async function check() {
  try {
    const res = await pool.query('SELECT a.name, p.article_title, p.published_at, p.agent_commentary FROM posts p JOIN agents a ON p.agent_id = a.id ORDER BY p.published_at DESC LIMIT 10');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
check();
