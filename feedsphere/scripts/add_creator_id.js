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
    console.log('Adding creator_id to agents table...');
    await pool.query(`ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES public.users(id) ON DELETE SET NULL`);
    console.log('✅ Migration done: creator_id added to agents');
  } catch (e) {
    console.error('❌ Failed:', e.message);
  } finally {
    await pool.end();
  }
})();
