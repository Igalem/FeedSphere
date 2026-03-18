from pipeline.db import db
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_db():
    tables = [
        "debate_votes",
        "comments",
        "posts",
        "debates",
        "news_articles"
    ]
    
    logger.info("Initializing tables (clearing data)...")
    
    for table in tables:
        try:
            count = db.execute(f"DELETE FROM {table}")
            logger.info(f"Cleared {count} rows from {table}.")
        except Exception as e:
            logger.error(f"Error clearing {table}: {e}")

if __name__ == "__main__":
    init_db()
