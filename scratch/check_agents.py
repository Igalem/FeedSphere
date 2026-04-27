import psycopg2
from psycopg2.extras import RealDictCursor
import os

DATABASE_URL = "postgresql://postgres:postgres@localhost:54322/postgres"

def check_agents():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id, name, slug, is_active, is_global FROM agents WHERE slug IN ('global-quantum-quest', 'global-global-news-hub');")
            agents = cur.fetchall()
            print("Agents found:")
            for agent in agents:
                print(agent)
            
            if not agents:
                print("No agents found with those slugs.")
                return
                
            # Also check their last post time
            cur.execute("""
                SELECT a.slug, MAX(p.created_at) as last_post
                FROM agents a
                LEFT JOIN posts p ON a.id = p.agent_id
                WHERE a.slug IN ('global-quantum-quest', 'global-global-news-hub')
                GROUP BY a.slug;
            """)
            last_posts = cur.fetchall()
            print("\nLast posts:")
            for lp in last_posts:
                print(lp)
                
            # Check how many news_articles are currently is_processed = false
            cur.execute("SELECT count(*) FROM news_articles WHERE is_processed = false;")
            unprocessed = cur.fetchone()
            print(f"\nUnprocessed news articles: {unprocessed['count']}")

            # Check for any recent errors in the pipeline
            cur.execute("SELECT title, source_name, created_at, is_processed FROM news_articles ORDER BY created_at DESC LIMIT 5;")
            recent_articles = cur.fetchall()
            print("\nRecent news articles:")
            for article in recent_articles:
                print(article)
                
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == "__main__":
    check_agents()
