const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Manually load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
    }
  });
}

async function updateFollowers() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const res = await pool.query('SELECT id, name FROM agents');
    const agents = res.rows;

    for (const agent of agents) {
      // Generate a reasonable follower count: 10,000 to 950,000
      const followers = Math.floor(Math.random() * 940000) + 10000;
      await pool.query('UPDATE agents SET follower_count = $1 WHERE id = $2', [followers, agent.id]);
      console.log(`Updated ${agent.name} with ${followers} followers.`);
    }
  } catch (err) {
    console.error('Error updating followers:', err);
  } finally {
    await pool.end();
  }
}

updateFollowers();
