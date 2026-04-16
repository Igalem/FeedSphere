import os
import sys
import requests
from bs4 import BeautifulSoup
import time

sys.path.append(os.path.abspath(os.path.dirname(__file__) + '/../..'))
from pipeline.db import db
from pipeline.crawler import BROWSER_HEADERS

def scrape_article(url):
    try:
        res = requests.get(url, timeout=10, headers=BROWSER_HEADERS)
        if res.status_code == 200:
            soup = BeautifulSoup(res.text, "html.parser")
            
            # Image extraction
            image_url = None
            meta_candidates = [
                ("meta", {"property": "og:image"}),
                ("meta", {"name": "twitter:image"}),
                ("meta", {"property": "twitter:image"}),
                ("meta", {"name": "thumbnail"}),
                ("link", {"rel": "image_src"}),
            ]
            for tag_type, attrs in meta_candidates:
                tag = soup.find(tag_type, attrs=attrs)
                if tag:
                    image_url = tag.get("content") or tag.get("href")
                    if image_url and not any(v in image_url for v in ["doubleclick.net", "ads.", ".svg", "logo", "icon"]): 
                        break
            # Fallback for Yahoo specifically if meta is tricky
            if not image_url and "yahoo.com" in url:
                for img in soup.find_all("img"):
                    src = img.get("src") or img.get("data-src")
                    if src and "/res/1.2/" in src and "YXBwaWQ" in src:
                        image_url = src
                        break
                        
            return image_url
    except:
        pass
    return None

def main():
    print("Starting comprehensive repair of all records with fallback images...")
    
    # 1. Fix Posts
    posts = db.fetch_all("SELECT id, article_url, article_image_url FROM posts WHERE article_image_url LIKE '%unsplash.com%'")
    print(f"Found {len(posts)} posts with fallback images.")
    for p in posts:
        print(f"Repairing post {p['id']} ({p['article_url']})")
        new_img = scrape_article(p['article_url'])
        if new_img:
            db.execute("UPDATE posts SET article_image_url = %s WHERE id = %s", (new_img, p['id']))
            print(f"Updated post {p['id']} -> {new_img}")
        else:
            print(f"Could not find better image for post {p['id']}")
            
    # 2. Fix Debates
    debates = db.fetch_all("SELECT id, article_url, article_image_url FROM debates WHERE article_image_url LIKE '%unsplash.com%'")
    print(f"Found {len(debates)} debates with fallback images.")
    for d in debates:
        print(f"Repairing debate {d['id']} ({d['article_url']})")
        new_img = scrape_article(d['article_url'])
        if new_img:
            db.execute("UPDATE debates SET article_image_url = %s WHERE id = %s", (new_img, d['id']))
            print(f"Updated debate {d['id']} -> {new_img}")
            
    # 3. Fix News Articles
    articles = db.fetch_all("SELECT id, url, image_url FROM news_articles WHERE image_url LIKE '%unsplash.com%'")
    print(f"Found {len(articles)} news articles with fallback images.")
    for a in articles:
        print(f"Repairing news article {a['id']} ({a['url']})")
        new_img = scrape_article(a['url'])
        if new_img:
            db.execute("UPDATE news_articles SET image_url = %s WHERE id = %s", (new_img, a['id']))
            print(f"Updated news article {a['id']} -> {new_img}")
            
    print("Repair process completed.")

if __name__ == "__main__":
    main()
