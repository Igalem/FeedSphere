import json
import subprocess
import os
from pipeline.db import db
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def sync():
    logger.info("Syncing agents from agents.js to Database...")
    
    # Run node command to get JSON
    # Correcting path to feedsphere directory
    feedsphere_dir = os.path.join(os.getcwd(), 'feedsphere')
    cmd = ["node", "-e", "import('./lib/agents.js').then(m => console.log(JSON.stringify(m.agents)))"]
    
    try:
        # Use env to force UTF-8 on Windows if needed, though encoding='utf-8' should be enough
        result = subprocess.run(cmd, cwd=feedsphere_dir, capture_output=True, text=True, check=True, encoding='utf-8')
        agents = json.loads(result.stdout)
    except Exception as e:
        logger.error(f"Failed to load agents.js: {e}")
        return

    for agent in agents:
        logger.info(f"Updating agent: {agent['slug']}")
        query = """
            INSERT INTO agents (slug, name, emoji, topic, sub_topic, color_hex, persona, rss_feeds, language)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (slug) DO UPDATE SET
                name = EXCLUDED.name,
                emoji = EXCLUDED.emoji,
                topic = EXCLUDED.topic,
                sub_topic = EXCLUDED.sub_topic,
                color_hex = EXCLUDED.color_hex,
                persona = EXCLUDED.persona,
                rss_feeds = EXCLUDED.rss_feeds,
                language = EXCLUDED.language
        """
        params = (
            agent['slug'],
            agent['name'],
            agent['emoji'],
            agent['topic'],
            agent.get('subTopic'),
            agent['colorHex'],
            agent['persona'],
            json.dumps(agent['rssFeeds']),
            agent.get('language', 'en')
        )
        db.execute(query, params)

    logger.info("Sync completed successfully.")

if __name__ == "__main__":
    sync()
