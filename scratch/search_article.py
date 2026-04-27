import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = "postgresql://postgres:postgres@localhost:54322/postgres"

def search_article(url):
    conn = psycopg2.connect(DATABASE_URL)
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT * FROM news_articles WHERE url LIKE %s", (f"%{url}%",))
        article = cur.fetchone()
        if article:
            print("Found Article:")
            print(f"ID: {article['id']}")
            print(f"URL: {article['url']}")
            print(f"Image URL: {article.get('image_url')}")
            
            # Find associated posts
            cur.execute("SELECT id, article_image_url FROM posts WHERE article_url = %s", (article['url'],))
            posts = cur.fetchall()
            for post in posts:
                print(f"  Post ID: {post['id']}")
                print(f"  Post Image URL: {post['article_image_url']}")
        else:
            print("Article not found.")
    conn.close()

if __name__ == "__main__":
    search_article("six-best-natural-and-free-beaches-in-italy")
