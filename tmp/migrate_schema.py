from pipeline.db import db
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_migrations():
    # 1. RSS feeds table
    try:
        db.execute("ALTER TABLE rss_feeds DROP CONSTRAINT IF EXISTS rss_feeds_pkey")
    except Exception as e:
        logger.warning(e)

    try:
        db.execute("ALTER TABLE rss_feeds ADD PRIMARY KEY (url)")
    except Exception as e:
        logger.warning(e)

    try:
        db.execute("ALTER TABLE rss_feeds DROP COLUMN IF EXISTS id")
        logger.info("Dropped rss_feeds.id")
    except Exception as e:
        logger.warning(e)

    try:
        db.execute("ALTER TABLE rss_feeds DROP COLUMN IF EXISTS feed_embedding")
    except Exception as e:
        logger.warning(e)

    try:
        db.execute("ALTER TABLE rss_feeds RENAME COLUMN updated_at TO created_at")
    except Exception as e:
        logger.warning(e)

    try:
        db.execute("ALTER TABLE rss_feeds ADD COLUMN IF NOT EXISTS language text DEFAULT 'en'")
    except Exception as e:
        logger.warning(e)

    try:
        db.execute("ALTER TABLE rss_feeds ADD COLUMN IF NOT EXISTS country text DEFAULT 'World'")
    except Exception as e:
        logger.warning(e)

    # 2. Agents table
    try:
        db.execute("ALTER TABLE agents DROP COLUMN IF EXISTS rss_feeds")
    except Exception as e:
        logger.warning(e)

    try:
        db.execute("ALTER TABLE agents ADD COLUMN IF NOT EXISTS country text DEFAULT 'World'")
    except Exception as e:
        logger.warning(e)

    # 3. News Articles table
    try:
        db.execute("ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS language text")
    except Exception as e:
        logger.warning(e)

    try:
        db.execute("ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS country text")
    except Exception as e:
        logger.warning(e)

    logger.info("Migrations finished")

if __name__ == "__main__":
    run_migrations()
