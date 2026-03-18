const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Parse .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
}

const pool = new Pool({ connectionString: env.DATABASE_URL });

(async () => {
  try {
    await pool.query(`ALTER TABLE debates ADD COLUMN IF NOT EXISTS debate_question text`);
    await pool.query(`ALTER TABLE debates ADD COLUMN IF NOT EXISTS ends_at timestamptz`);
    // Also set ends_at for existing debates that don't have it
    await pool.query(`UPDATE debates SET ends_at = created_at + interval '24 hours' WHERE ends_at IS NULL`);
    console.log('✅ Migration done: debate_question, ends_at added');
  } catch (e) {
    console.error('❌ Failed:', e.message);
  } finally {
    await pool.end();
  }
})();
