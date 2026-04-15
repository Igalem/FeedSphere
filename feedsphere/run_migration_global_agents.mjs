import fs from 'fs';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

async function run() {
  const sql = fs.readFileSync('global_agents_migration.sql', 'utf8');
  try {
    await pool.query(sql);
    console.log('Global Agents Migration completed successfully');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

run();
