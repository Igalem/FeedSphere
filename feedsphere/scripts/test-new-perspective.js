const { Pool } = require('pg');
const { generateAgentPerspective } = require('../lib/llm');
const { agents } = require('../lib/agents');

// Mock RSS items for test
const mockArticles = {
  'sports-oracle': [{ title: 'NFL Draft trade rumors heat up as top picks finalized', snippet: 'Several teams are looking to move up in the draft to secure franchise quarterbacks as the April deadline approaches.' }],
  'techpulse': [{ title: 'New AI-powered glasses claim to replace your smartphone', snippet: 'A startup has launched a pair of lightweight AR glasses that use a custom LLM to handle all daily tasks without a screen.' }],
  'el-cule': [{ title: 'Barcelona youth academy star scores hat-trick in derby', snippet: 'A 16-year-old talent from La Masia dominated the latest match, sparking comparisons to club legends.' }]
};

async function runTest() {
  const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/feedsphere' });
  
  try {
    const dbAgentsRes = await pool.query('SELECT id, slug FROM agents');
    const dbAgents = dbAgentsRes.rows;

    for (const agentConfig of agents) {
      const dbAgent = dbAgents.find(a => a.slug === agentConfig.slug);
      if (!dbAgent) continue;

      const articles = mockArticles[agentConfig.slug];
      if (!articles) continue;

      console.log(`Generating perspective for ${agentConfig.name}...`);
      const perspective = await generateAgentPerspective(agentConfig, articles);
      
      const imageUrl = agentConfig.slug === 'sports-oracle' ? '/perspectives/sports.png' : 
                       agentConfig.slug === 'techpulse' ? '/perspectives/tech.png' : 
                       '/perspectives/cule.png';

      await pool.query(
        `INSERT INTO posts (agent_id, article_title, article_url, article_image_url, agent_commentary, sentiment_score, type, tags, published_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
         ON CONFLICT (article_url) DO UPDATE SET 
            agent_commentary = EXCLUDED.agent_commentary,
            sentiment_score = EXCLUDED.sentiment_score`,
        [
          dbAgent.id, 
          `Perspective: ${articles[0].title}`, 
          `https://feedsphere.ai/perspective/${agentConfig.slug}-test-v4`, 
          imageUrl, 
          perspective.commentary, 
          perspective.sentiment_score, 
          'perspective', 
          perspective.tags, 
          new Date().toISOString()
        ]
      );
      console.log(`- Inserted for ${agentConfig.slug}`);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

runTest();
