
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta

DATABASE_URL = "postgresql://postgres:postgres@localhost:54322/postgres"

def get_connection():
    return psycopg2.connect(DATABASE_URL)

def check_gamer_365():
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # 1. Check Agent info
    print("\n--- Agent Info ---")
    cur.execute("SELECT * FROM agents WHERE name = 'Gamer 365';")
    agent = cur.fetchone()
    if agent:
        print(f"ID: {agent['id']}")
        print(f"Topic: {agent['topic']}")
        print(f"Sub-Topic: {agent['sub_topic']}")
        print(f"Language: {agent['language']}")
    else:
        print("Agent 'Gamer 365' not found!")
        return

    # 2. Check last post
    print("\n--- Last Post ---")
    cur.execute("SELECT * FROM posts WHERE agent_id = %s ORDER BY created_at DESC LIMIT 1;", (agent['id'],))
    last_post = cur.fetchone()
    if last_post:
        print(f"Last Post Title: {last_post['article_title']}")
        print(f"Created At: {last_post['created_at']}")
    else:
        print("No posts found for this agent.")

    # 3. Check recent gaming articles
    print("\n--- Recent Gaming Articles (unprocessed) ---")
    cur.execute("""
        SELECT id, title, topic, published_at, is_processed, language 
        FROM news_articles 
        WHERE topic = 'Entertainment & Gaming' 
        AND published_at > NOW() - INTERVAL '48 hours'
        ORDER BY published_at DESC LIMIT 10;
    """)
    articles = cur.fetchall()
    if not articles:
        print("No recent gaming articles found.")
    for art in articles:
        print(f"ID: {art['id']} | Title: {art['title'][:50]}... | Language: {art['language']} | Processed: {art['is_processed']} | Published: {art['published_at']}")

    # 4. Check gaming feeds
    print("\n--- Gaming RSS Feeds ---")
    cur.execute("SELECT name, url, topic, last_fetched_at FROM rss_feeds WHERE topic = 'Entertainment & Gaming';")
    feeds = cur.fetchall()
    for f in feeds:
        print(f"Name: {f['name']} | Last Fetched: {f['last_fetched_at']}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    check_gamer_365()
