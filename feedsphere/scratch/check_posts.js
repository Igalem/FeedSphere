import { db } from './lib/db.js';

async function checkPosts() {
  try {
    const res = await db.query('SELECT id, article_title, created_at, agent_id FROM posts ORDER BY created_at DESC LIMIT 5;');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error(e);
  }
}

checkPosts();
