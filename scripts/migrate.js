const { Client } = require('pg');

async function migrate() {
  const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/feedsphere' });
  try {
    await client.connect();
    await client.query("ALTER TABLE posts ADD COLUMN IF NOT EXISTS type text DEFAULT 'reaction';");
    console.log("Migration successful: Added 'type' column to posts table.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

migrate();
