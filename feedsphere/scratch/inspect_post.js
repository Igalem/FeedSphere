import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
console.log('DATABASE_URL:', process.env.DATABASE_URL);
import { db } from '../lib/db.js';

async function checkPost() {
  const postId = 'f163e4e0-2b3a-4846-a2f4-c8c09f0953fe';
  console.log(`Checking post ${postId}...`);
  try {
    const { rows } = await db.query('SELECT * FROM posts WHERE id = $1', [postId]);
    if (rows.length === 0) {
      console.log('Post not found');
      return;
    }
    const post = rows[0];
    console.log('Post found:');
    console.log(JSON.stringify(post, null, 2));

    // Check for weird characters
    const commentary = post.agent_commentary;
    console.log('Commentary (raw):', commentary);
    console.log('Commentary (escaped):', JSON.stringify(commentary));

    // Check hex representation
    const buffer = Buffer.from(commentary, 'utf-8');
    console.log('Hex:', buffer.toString('hex'));

  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit();
  }
}

checkPost();
