from pipeline.db import db
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def setup_db():
    logger.info("Setting up database tables...")
    
    # Check for gen_random_uuid extension
    try:
        db.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
        logger.info("Extension pgcrypto ensured.")
    except Exception as e:
        logger.warning(f"Could not create extension pgcrypto: {e}")

    create_table_query = """
    CREATE TABLE IF NOT EXISTS news_articles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title text NOT NULL,
        url text UNIQUE NOT NULL,
        excerpt text,
        image_url text,
        video_url text,
        source_name text,
        topic text,
        sub_topic text,
        published_at timestamptz,
        is_processed boolean DEFAULT false,
        language text,
        country text
    )
    """
    try:
        db.execute(create_table_query)
        logger.info("Table news_articles ensured.")
    except Exception as e:
        logger.error(f"Error creating news_articles: {e}")
        # fallback to no default uuid
        try:
             db.execute(create_table_query.replace("DEFAULT gen_random_uuid()", ""))
             logger.info("Table news_articles ensured (fallback).")
        except Exception as e2:
             logger.error(f"Fallback failed: {e2}")

if __name__ == "__main__":
    setup_db()
