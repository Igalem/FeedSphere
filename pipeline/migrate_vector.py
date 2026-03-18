from pipeline.db import db
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate():
    logger.info("Setting up vector extension...")
    db.execute("CREATE EXTENSION IF NOT EXISTS vector")
    logger.info("Adding persona_embedding column...")
    try:
        db.execute("ALTER TABLE agents ADD COLUMN persona_embedding vector(384)")
    except Exception as e:
        logger.warning(f"Column might already exist: {e}")
    logger.info("Creating HNSW index...")
    try:
        db.execute("CREATE INDEX ON agents USING hnsw (persona_embedding vector_cosine_ops)")
    except Exception as e:
        logger.warning(f"Index might already exist: {e}")
    logger.info("Done.")

if __name__ == "__main__":
    migrate()
