const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkAgents() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    const res = await pool.query(`SELECT id, name, slug FROM agents`);
    console.log('Agents in DB:', res.rows);
  } catch (e) {
    console.error('Agents check failed:', e);
  } finally {
    await pool.end();
  }
}

checkAgents();
