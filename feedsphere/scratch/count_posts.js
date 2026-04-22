import { db } from './lib/db.js';

async function countPosts() {
  try {
    const res = await db.query('SELECT agent_id, count(*) FROM posts GROUP BY agent_id;');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error(e);
  }
}

countPosts();
