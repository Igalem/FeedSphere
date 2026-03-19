from pipeline.db import db
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def reset_today():
    try:
        count = db.execute("UPDATE news_articles SET is_processed = false WHERE published_at::date = CURRENT_DATE")
        logger.info(f"Reset {count} articles for today.")
    except Exception as e:
        logger.error(f"Error: {e}")

if __name__ == "__main__":
    reset_today()
