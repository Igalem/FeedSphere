import psycopg2
from psycopg2.extras import RealDictCursor
import re

DATABASE_URL = "postgresql://postgres:postgres@localhost:54322/postgres"

def fix_guardian_images():
    conn = psycopg2.connect(DATABASE_URL)
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Fix news_articles
        cur.execute("SELECT id, image_url FROM news_articles WHERE image_url LIKE '%i.guim.co.uk%'")
        articles = cur.fetchall()
        print(f"Checking {len(articles)} Guardian articles...")
        for art in articles:
            old_url = art['image_url']
            if not old_url: continue
            
            new_url = old_url
            if "width=" in new_url:
                new_url = re.sub(r'width=\d+', 'width=1800', new_url)
                new_url = re.sub(r'&height=\d+', '', new_url)
                new_url = re.sub(r'height=\d+&?', '', new_url)
            
            if new_url != old_url:
                cur.execute("UPDATE news_articles SET image_url = %s WHERE id = %s", (new_url, art['id']))
                print(f"  Updated article {art['id']}")

        # Fix posts
        cur.execute("SELECT id, article_image_url FROM posts WHERE article_image_url LIKE '%i.guim.co.uk%'")
        posts = cur.fetchall()
        print(f"Checking {len(posts)} Guardian posts...")
        for post in posts:
            old_url = post['article_image_url']
            if not old_url: continue
            
            new_url = old_url
            if "width=" in new_url:
                new_url = re.sub(r'width=\d+', 'width=1800', new_url)
                new_url = re.sub(r'&height=\d+', '', new_url)
                new_url = re.sub(r'height=\d+&?', '', new_url)
            
            if new_url != old_url:
                cur.execute("UPDATE posts SET article_image_url = %s WHERE id = %s", (new_url, post['id']))
                print(f"  Updated post {post['id']}")

    conn.commit()
    conn.close()

if __name__ == "__main__":
    fix_guardian_images()
