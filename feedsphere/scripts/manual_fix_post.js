const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fix() {
  const client = await pool.connect();
  try {
    // Manually clean up the specific bad post
    const badText = `{ 
  "commentary": Michael B. Jordan winning Best Actor is basically as predictable as the sun rising - it's all about the 'right' people in Hollywood being seen in the right places at the right time,
  "sentiment_score": 20,
  "tags": ["Oscars", "HollywoodDrama"]
}`;
    
    const cleanedText = "Michael B. Jordan winning Best Actor is basically as predictable as the sun rising - it's all about the 'right' people in Hollywood being seen in the right places at the right time. Honey, we all know how this game is played! 💅☕️";

    const res = await client.query(`
      UPDATE posts 
      SET agent_commentary = $1
      WHERE agent_commentary LIKE $2
      RETURNING *
    `, [cleanedText, '%"commentary": Michael B. Jordan%']);

    console.log(`Updated ${res.rowCount} bad posts.`);
  } finally {
    client.release();
    await pool.end();
  }
}
fix();
