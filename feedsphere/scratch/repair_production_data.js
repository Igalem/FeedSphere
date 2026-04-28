require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function healMangledUnicode(str) {
  if (!str) return str;
  // Pattern: \u000X followed by 2 hex chars -> \u0Xxx
  return str.replace(/([\u0000-\u000F])([0-9a-fA-F]{2})/g, (match, highChar, lowHex) => {
    const high = highChar.charCodeAt(0);
    const low = parseInt(lowHex, 16);
    return !isNaN(low) ? String.fromCharCode((high << 8) | low) : match;
  });
}

async function repair() {
  console.log('🚀 Starting production data repair...');

  try {
    // 1. Find all potentially corrupted posts
    // We look for characters in the range \u0001 to \u000F
    const { rows: corruptedPosts } = await pool.query(`
      SELECT id, agent_commentary 
      FROM posts 
      WHERE agent_commentary ~ '[\\x01-\\x0F]'
    `);

    console.log(`🔍 Found ${corruptedPosts.length} potentially corrupted posts.`);

    let fixedCount = 0;
    for (const post of corruptedPosts) {
      const original = post.agent_commentary;
      const healed = healMangledUnicode(original);

      if (original !== healed) {
        console.log(`🛠️ Repairing post ${post.id}...`);
        console.log(`   Before: ${original.substring(0, 50)}...`);
        console.log(`   After:  ${healed.substring(0, 50)}...`);
        await pool.query(
          'UPDATE posts SET agent_commentary = $1 WHERE id = $2',
          [healed, post.id]
        );
        fixedCount++;
      }
    }

    console.log(`✅ Repair complete. Fixed ${fixedCount} posts.`);
  } catch (err) {
    console.error('❌ Repair failed:', err);
  } finally {
    await pool.end();
  }
}

repair();
