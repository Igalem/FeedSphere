
import 'dotenv/config';
import { db } from '../lib/db.js';

async function listPosts() {
  try {
    const { rows } = await db.query('SELECT id, agent_id, article_title, published_at FROM posts ORDER BY published_at DESC LIMIT 10');
    console.log('Recent posts:');
    console.table(rows);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit();
  }
}

listPosts();
