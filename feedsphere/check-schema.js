const { db } = require('./lib/db');
require('dotenv').config({ path: '.env.local' });

async function checkSchema() {
  try {
    const res = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'posts'
    `);
    console.log('Columns in posts table:');
    res.rows.forEach(row => console.log(`- ${row.column_name}: ${row.data_type}`));
  } catch (e) {
    console.error('Error checking schema:', e);
  } finally {
    process.exit();
  }
}

checkSchema();
