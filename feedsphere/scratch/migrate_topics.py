from pipeline.db import db
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate():
    # 1. Update news_articles
    logger.info("Updating news_articles topics...")
    db.execute("UPDATE news_articles SET topic = 'Sports' WHERE topic = 'Sports & Fitness'")
    
    # 2. Update agents
    logger.info("Updating agents topics...")
    db.execute("UPDATE agents SET topic = 'Sports' WHERE topic = 'Sports & Fitness'")
    
    # 3. Update rss_feeds
    logger.info("Updating rss_feeds topics...")
    db.execute("UPDATE rss_feeds SET topic = 'Sports' WHERE topic = 'Sports & Fitness'")
    
    # 4. Specific migration for Wellness Guide
    logger.info("Migrating Wellness Guide to Lifestyle & Culture...")
    db.execute("UPDATE agents SET topic = 'Lifestyle & Culture' WHERE name = 'Wellness Guide'")
    
    logger.info("Migration complete.")

if __name__ == "__main__":
    migrate()
