from pipeline.db import db
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate():
    logger.info("Setting up vector extension if needed...")
    db.execute("CREATE EXTENSION IF NOT EXISTS vector")
    logger.info("Adding feed_embedding column to rss_feeds...")
    try:
        db.execute("ALTER TABLE rss_feeds ADD COLUMN feed_embedding vector(384)")
    except Exception as e:
        logger.warning(f"Column might already exist: {e}")
    logger.info("Creating HNSW index on feed_embedding...")
    try:
        db.execute("CREATE INDEX ON rss_feeds USING hnsw (feed_embedding vector_cosine_ops)")
    except Exception as e:
        logger.warning(f"Index might already exist: {e}")
    logger.info("Done.")

if __name__ == "__main__":
    migrate()
