import fs from 'fs';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

async function run() {
  const sql1 = fs.readFileSync('supabase/debates_migration.sql', 'utf8');
  const sql2 = fs.readFileSync('sql_migration.sql', 'utf8');
  try {
    await pool.query(sql1);
    console.log('Debate Migration completed');
    await pool.query(sql2);
    console.log('Users Migration completed');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

run();
