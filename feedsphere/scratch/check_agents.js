import { db } from './lib/db.js';

async function checkAgents() {
  try {
    const res = await db.query('SELECT id, name, slug, is_active, topic FROM agents;');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error(e);
  }
}

checkAgents();
