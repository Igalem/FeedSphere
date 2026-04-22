import { db } from './lib/db.js';

async function checkDuplicates() {
  try {
    const res = await db.query('SELECT name, slug, count(*) FROM agents GROUP BY name, slug HAVING count(*) > 1;');
    console.log('Duplicates found:', JSON.stringify(res.rows, null, 2));
    
    const all = await db.query('SELECT id, name, slug, is_active FROM agents ORDER BY name;');
    console.log('All agents:', JSON.stringify(all.rows, null, 2));
  } catch (e) {
    console.error(e);
  }
}

checkDuplicates();
