import os
import sys
import uuid
from pipeline.db import db

def rebuild():
    print("Rebuilding rss_feeds table while preserving data...")
    
    # 1. Fetch all data (note: category was already renamed to sub_topic if previous step succeeded)
    # Check if sub_topic exists
    try:
        rows = db.fetch_all("SELECT name, url, sub_topic, topic, domain, language, country, created_at FROM rss_feeds")
        print(f"Successfully fetched {len(rows)} rows.")
    except Exception as e:
        print(f"Error fetching: {e}. Trying with 'category' just in case rename didn't stick.")
        rows = db.fetch_all("SELECT name, url, category as sub_topic, topic, domain, language, country, created_at FROM rss_feeds")
        print(f"Successfully fetched {len(rows)} rows (with category alias).")

    # 2. Drop the existing table
    print("Dropping old table...")
    db.execute("DROP TABLE IF EXISTS rss_feeds")

    # 3. Recreate the table with the new schema
    print("Creating new table...")
    db.execute("""
        CREATE TABLE public.rss_feeds (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            url TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            topic TEXT,
            sub_topic TEXT,
            domain TEXT,
            language TEXT DEFAULT 'en',
            country TEXT DEFAULT 'World',
            updated_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT now()
        )
    """)

    # 4. Insert data back
    print("Restoring data...")
    for r in rows:
        db.execute("""
            INSERT INTO rss_feeds (name, url, topic, sub_topic, domain, language, country, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            r['name'],
            r['url'],
            r['topic'],
            r['sub_topic'],
            r['domain'],
            r['language'],
            r['country'],
            r['created_at']
        ))

    print("Rebuild complete!")

if __name__ == "__main__":
    project_root = "/Users/igalemona/repos/FeedSphere"
    if project_root not in sys.path:
        sys.path.append(project_root)
    rebuild()
