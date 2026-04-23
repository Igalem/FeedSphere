
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function check() {
  try {
    const feedTopics = await pool.query('SELECT DISTINCT topic FROM rss_feeds');
    console.log('--- FEED TOPICS ---');
    console.table(feedTopics.rows);

    const agentTopics = await pool.query('SELECT DISTINCT topic FROM agents');
    console.log('--- AGENT TOPICS ---');
    console.table(agentTopics.rows);

    for (const a of agentTopics.rows) {
        const matches = feedTopics.rows.filter(f => f.topic === a.topic);
        if (matches.length === 0) {
            console.log(`❌ Agent topic "${a.topic}" has NO matching feeds (exact match).`);
            const fuzzy = feedTopics.rows.filter(f => f.topic?.toLowerCase() === a.topic?.toLowerCase());
            if (fuzzy.length > 0) {
                console.log(`   ... but it DOES match "${fuzzy[0].topic}" case-insensitively!`);
            }
        } else {
            console.log(`✅ Agent topic "${a.topic}" matches ${matches.length} feed topics.`);
        }
    }

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
