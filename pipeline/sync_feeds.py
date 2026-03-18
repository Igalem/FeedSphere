from pipeline.db import db
import logging
import json
from urllib.parse import urlparse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def sync_feeds():
    logger.info("Syncing RSS feeds from agents table to rss_feeds table...")
    
    # 1. Fetch all agents and their rss_feeds JSON
    agents = db.fetch_all("SELECT topic, sub_topic, rss_feeds FROM agents")
    
    if not agents:
        logger.warning("No agents found in database. Run sync_agents first.")
        return

    unique_feeds = {} # url -> feed_info
    
    for agent in agents:
        try:
            # rss_feeds is stored as JSON string or dict depending on driver/DB
            feeds = agent['rss_feeds']
            if isinstance(feeds, str):
                feeds = json.loads(feeds)
            
            for feed in feeds:
                url = feed.get('url')
                if not url:
                    continue
                
                if url not in unique_feeds:
                    domain = urlparse(url).netloc
                    unique_feeds[url] = {
                        'name': feed.get('name', 'Unknown Source'),
                        'url': url,
                        'topic': agent['topic'],
                        'category': agent.get('sub_topic') or agent['topic'],
                        'domain': domain
                    }
        except Exception as e:
            logger.error(f"Error processing feeds for agent: {e}")

    logger.info(f"Found {len(unique_feeds)} unique feeds to sync.")

    # 2. Insert/Update into rss_feeds
    for url, feed in unique_feeds.items():
        query = """
            INSERT INTO rss_feeds (name, url, topic, category, domain)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (url) DO UPDATE SET
                name = EXCLUDED.name,
                topic = EXCLUDED.topic,
                category = EXCLUDED.category,
                domain = EXCLUDED.domain
        """
        params = (feed['name'], feed['url'], feed['topic'], feed['category'], feed['domain'])
        try:
            db.execute(query, params)
            logger.info(f"Synced: {feed['name']}")
        except Exception as e:
            logger.error(f"Failed to sync feed {url}: {e}")

    logger.info("Feed sync completed successfully.")

if __name__ == "__main__":
    sync_feeds()
