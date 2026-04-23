
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  try {
    console.log('🚀 Starting Feed Topic Migration...');

    // 1. Sports & Fitness -> Sports
    const sportsRes = await pool.query("UPDATE rss_feeds SET topic = 'Sports' WHERE topic = 'Sports & Fitness'");
    console.log(`✅ Updated ${sportsRes.rowCount} feeds: Sports & Fitness -> Sports`);

    // 2. Science -> Tech & Science
    const scienceRes = await pool.query("UPDATE rss_feeds SET topic = 'Tech & Science' WHERE topic = 'Science'");
    console.log(`✅ Updated ${scienceRes.rowCount} feeds: Science -> Tech & Science`);

    // 3. Entertainment & Gaming -> Entertainment (Initial pass)
    const entRes = await pool.query("UPDATE rss_feeds SET topic = 'Entertainment' WHERE topic = 'Entertainment & Gaming'");
    console.log(`✅ Updated ${entRes.rowCount} feeds: Entertainment & Gaming -> Entertainment`);

    // 4. Refine Gaming topics based on keywords in name or domain
    const gamingKeywords = [
        'game', 'gamer', 'gaming', 'polygon', 'ign', 'steam', 'eurogamer', 
        'escapist', 'nintendo', 'playstation', 'xbox', 'kotaku', 'destructoid',
        'rockpapershotgun', 'indiegames', 'gematsu', 'pcgamer'
    ];
    
    let gamingCount = 0;
    for (const kw of gamingKeywords) {
        const res = await pool.query(
            "UPDATE rss_feeds SET topic = 'Gaming' WHERE topic = 'Entertainment' AND (name ILIKE $1 OR domain ILIKE $1 OR url ILIKE $1)", 
            [`%${kw}%`]
        );
        gamingCount += res.rowCount;
    }
    console.log(`✅ Refined ${gamingCount} Gaming feeds from Entertainment.`);

    // 5. Final check of counts
    const counts = await pool.query("SELECT topic, count(*) FROM rss_feeds GROUP BY topic ORDER BY count DESC");
    console.log('\n--- NEW TOPIC COUNTS ---');
    console.table(counts.rows);

  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await pool.end();
  }
}

migrate();
