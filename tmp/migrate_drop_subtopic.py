import os
import sys
from pipeline.db import db

def migrate():
    print("🚀 Starting Database Migration...")
    
    # 1. Drop sub_topic column from rss_feeds and news_articles
    try:
        print("  - Dropping 'sub_topic' from 'rss_feeds'...")
        db.execute("ALTER TABLE rss_feeds DROP COLUMN IF EXISTS sub_topic;")
        
        print("  - Dropping 'sub_topic' from 'news_articles'...")
        db.execute("ALTER TABLE news_articles DROP COLUMN IF EXISTS sub_topic;")
        
        print("✅ Migration Completed: 'sub_topic' removed from rss_feeds and news_articles.")
    except Exception as e:
        print(f"❌ Migration Failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    migrate()
