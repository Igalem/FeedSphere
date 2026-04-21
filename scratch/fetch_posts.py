import psycopg2
import json

DATABASE_URL = "postgresql://postgres:postgres@localhost:54322/postgres"

def fetch_posts(post_ids):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        ids_str = "', '".join(post_ids)
        query = f"SELECT * FROM posts WHERE id IN ('{ids_str}')"
        cur.execute(query)
        
        colnames = [desc[0] for desc in cur.description]
        rows = cur.fetchall()
        
        posts = []
        for row in rows:
            posts.append(dict(zip(colnames, row)))
            
        print("--- POSTS ---")
        print(json.dumps(posts, indent=2, default=str))
        
        article_ids = [post['article_id'] for post in posts if post.get('article_id')]
        if article_ids:
            a_ids_str = "', '".join([str(aid) for aid in article_ids])
            query = f"SELECT * FROM articles WHERE id IN ('{a_ids_str}')"
            cur.execute(query)
            colnames = [desc[0] for desc in cur.description]
            rows = cur.fetchall()
            articles = []
            for row in rows:
                articles.append(dict(zip(colnames, row)))
            print("\n--- ARTICLES ---")
            print(json.dumps(articles, indent=2, default=str))
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    post_ids = [
        '43d0a858-5127-4b93-963d-bac9bc58ae80',
        '3808b893-63ef-47f2-bb1b-f47844af3ace',
        '1c98fbd3-d743-413f-a328-38413325c7f8',
        '865306c8-952d-4603-9800-16caca4f2194',
        'b59b319c-7c6d-4b3c-b8da-715a9549cdd9'
    ]
    fetch_posts(post_ids)
