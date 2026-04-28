
import { db } from './lib/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  try {
    const postCount = await db.query('SELECT count(*) FROM posts');
    const agentCount = await db.query('SELECT count(*) FROM agents');
    const followsCount = await db.query('SELECT count(*) FROM user_follows');

    console.log('Post count:', postCount.rows[0].count);
    console.log('Agent count:', agentCount.rows[0].count);
    console.log('User follows count:', followsCount.rows[0].count);

    const recentPosts = await db.query('SELECT id, title, created_at FROM posts ORDER BY created_at DESC LIMIT 5');
    console.log('Recent posts:', recentPosts.rows);

  } catch (err) {
    console.error('Error checking DB:', err);
  }
}

check();
