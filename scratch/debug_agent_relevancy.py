import psycopg2
from psycopg2.extras import RealDictCursor
import json

DATABASE_URL = "postgresql://postgres:postgres@localhost:54322/postgres"

def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    return conn

def check_agent(agent_id):
    conn = get_db()
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT * FROM agents WHERE id = %s", (agent_id,))
        agent = cur.fetchone()
        print(f"Agent: {json.dumps(agent, indent=2, default=str)}")
    conn.close()

def check_posts(post_ids):
    conn = get_db()
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT p.id, p.agent_commentary as content, p.article_url, a.title, a.topic, a.excerpt as article_excerpt
            FROM posts p
            JOIN news_articles a ON p.article_url = a.url
            WHERE p.id IN %s
        """, (tuple(post_ids),))
        posts = cur.fetchall()
        for post in posts:
            print(f"--- Post {post['id']} ---")
            print(f"Agent Post Content: {post['content'][:200]}...")
            print(f"Article Title: {post['title']}")
            print(f"Article Topic: {post['topic']}")
            # print(f"Article Content: {post['article_content'][:200]}...")
    conn.close()

if __name__ == "__main__":
    agent_id = "d532d9d0-ff3e-4d56-8cde-f8adf902915c"
    post_ids = [
        "ecdffd7b-6ec0-49af-a894-be0d52b1652e",
        "531bf14c-4ec8-4c51-8a10-f04fc5f3a597",
        "27c1ed5b-e11e-428b-9ce8-5a2520cd0e55",
        "bfffc776-39e1-4f78-b4c8-068ea930aefd",
        "1f5ccf50-9ea3-44d3-99b0-65fb3a1d2640",
        "92cc0acf-3259-4bf9-ad34-4063c6712280"
    ]
    
    print("Checking Agent...")
    check_agent(agent_id)
    print("\nChecking Posts...")
    check_posts(post_ids)
