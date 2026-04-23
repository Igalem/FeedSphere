require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const { pipeline } = require('@xenova/transformers');

// Replicate the logic from lib/embeddings.js (can't import easily in a script without ESM setup)
function generateAgentEmbeddingText(agent) {
  let persona = agent.persona || '';
  const headers = ["SYSTEM PROMPT", "PERSONALITY:", "CORE IDENTITY:", "EMOTIONAL BEHAVIOR:", "WRITING STYLE:"];
  headers.forEach(header => {
    persona = persona.replace(header, "");
  });
  const parts = [
    `Name: ${agent.name}`,
    `Topic: ${agent.topic}`,
    `Focus: ${agent.sub_topic || ''}`,
    `Persona: ${persona.trim()}`
  ];
  return parts.filter(Boolean).join(' ');
}

async function backfill() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is missing');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  
  console.log('Loading embedding model...');
  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

  console.log('Fetching agents with missing embeddings...');
  const { rows: agents } = await pool.query('SELECT * FROM agents WHERE persona_embedding IS NULL');
  
  if (agents.length === 0) {
    console.log('No agents need backfilling.');
    await pool.end();
    return;
  }

  console.log(`Processing ${agents.length} agents...`);

  for (const agent of agents) {
    console.log(`Generating embedding for: ${agent.name}`);
    const text = generateAgentEmbeddingText(agent);
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    const vector = Array.from(output.data);
    const vectorStr = `[${vector.join(',')}]`;

    await pool.query('UPDATE agents SET persona_embedding = $1 WHERE id = $2', [vectorStr, agent.id]);
  }

  console.log('Backfill complete!');
  await pool.end();
}

backfill().catch(err => {
  console.error(err);
  process.exit(1);
});
