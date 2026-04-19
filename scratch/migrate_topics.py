import psycopg2
from psycopg2.extras import RealDictCursor
import re

DATABASE_URL = "postgresql://postgres:postgres@localhost:54322/postgres"

def migrate():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    conn.autocommit = True

    print("--- 1. Migrating RSS Feeds ---")
    
    # First, move all 'Entertainment & Gaming' to 'Entertainment'
    count = db_execute(cur, "UPDATE rss_feeds SET topic = 'Entertainment' WHERE topic = 'Entertainment & Gaming'")
    print(f"Moved {count} broad feeds to 'Entertainment'")
    
    # Then, identify specifically 'Gaming' feeds
    gaming_keywords = ['gaming', 'games', 'esports', 'steam', 'playstation', 'xbox', 'nintendo', 'ign', 'polygon', 'kotaku', 'gamespot']
    for kw in gaming_keywords:
        count = db_execute(cur, "UPDATE rss_feeds SET topic = 'Gaming' WHERE (topic = 'Entertainment' OR name ILIKE %s OR url ILIKE %s) AND (name ILIKE %s OR url ILIKE %s)", 
                           (f'%{kw}%', f'%{kw}%', f'%{kw}%', f'%{kw}%'))
        if count > 0:
            print(f"Found {count} feeds for keyword '{kw}' -> moved to 'Gaming'")

    print("\n--- 2. Migrating Agents ---")
    # Update agents
    count = db_execute(cur, "UPDATE agents SET topic = 'Entertainment' WHERE topic = 'Entertainment & Gaming'")
    print(f"Moved {count} agents to 'Entertainment'")
    
    # Specific Gamer agents
    count = db_execute(cur, "UPDATE agents SET topic = 'Gaming' WHERE name ILIKE '%gamer%' OR persona ILIKE '%gaming%' OR persona ILIKE '%esports%'")
    print(f"Identified {count} Gaming agents (including Gamer 365).")

    print("\n--- 3. Migrating News Articles ---")
    # Move all broad to 'Entertainment' first
    count = db_execute(cur, "UPDATE news_articles SET topic = 'Entertainment' WHERE topic = 'Entertainment & Gaming'")
    print(f"Initial move of {count} articles to 'Entertainment'.")
    
    # Refine Gaming articles (using title keywords)
    # This is a bit slow but necessary for consistency
    count = db_execute(cur, """
        UPDATE news_articles 
        SET topic = 'Gaming' 
        WHERE topic = 'Entertainment' 
        AND (
            title ILIKE '%game%' OR title ILIKE '%gaming%' OR title ILIKE '%esports%' OR 
            title ILIKE '%playstation%' OR title ILIKE '%xbox%' OR title ILIKE '%nintendo%' OR
            title ILIKE '%steam%' OR title ILIKE '%fortnite%' OR title ILIKE '%roblox%'
        )
    """)
    print(f"Refined {count} articles to 'Gaming' based on keywords.")

    conn.close()

def db_execute(cur, query, params=None):
    cur.execute(query, params)
    return cur.rowcount

if __name__ == "__main__":
    migrate()
