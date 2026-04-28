
import 'dotenv/config';
import { db } from '../lib/db.js';

async function checkAgents() {
  try {
    const { rows } = await db.query('SELECT name, persona, language FROM agents');
    console.log('Agents:');
    console.table(rows);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit();
  }
}

checkAgents();
