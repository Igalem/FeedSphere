import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = "postgresql://postgres:postgres@localhost:54322/postgres"

def search_posts(url_part):
    conn = psycopg2.connect(DATABASE_URL)
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT id, article_url, article_image_url FROM posts WHERE article_url LIKE %s", (f"%{url_part}%",))
        posts = cur.fetchall()
        if posts:
            for post in posts:
                print(f"Post ID: {post['id']}")
                print(f"Article URL: {post['article_url']}")
                print(f"Image URL: {post['article_image_url']}")
        else:
            print("No posts found.")
    conn.close()

if __name__ == "__main__":
    search_posts("six-best-natural-and-free-beaches-in-italy")
