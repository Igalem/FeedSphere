const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkSchema() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'posts'
    `);
    console.log('Posts Schema:', res.rows);
    
    const constraints = await pool.query(`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE conrelid = 'posts'::regclass
    `);
    console.log('Posts Constraints:', constraints.rows);

  } catch (e) {
    console.error('Schema check failed:', e);
  } finally {
    await pool.end();
  }
}

checkSchema();
