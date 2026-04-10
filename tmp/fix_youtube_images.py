from pipeline.db import db
import logging
import re

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def fix_urls():
    # 1. Check news_articles
    articles = db.fetch_all("SELECT id, image_url FROM news_articles WHERE image_url LIKE '%youtube.com/embed/%'")
    logger.info(f"Fixing {len(articles)} YouTube URLs in news_articles...")
    for art in articles:
        video_id = art['image_url'].split("youtube.com/embed/")[1].split("?")[0].split("/")[0]
        new_url = f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"
        db.execute("UPDATE news_articles SET image_url = %s WHERE id = %s", (new_url, art['id']))
    
    # 2. Check posts
    posts = db.fetch_all("SELECT id, article_image_url FROM posts WHERE article_image_url LIKE '%youtube.com/embed/%'")
    logger.info(f"Fixing {len(posts)} YouTube URLs in posts...")
    for post in posts:
        video_id = post['article_image_url'].split("youtube.com/embed/")[1].split("?")[0].split("/")[0]
        new_url = f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"
        db.execute("UPDATE posts SET article_image_url = %s WHERE id = %s", (new_url, post['id']))

if __name__ == "__main__":
    fix_urls()
