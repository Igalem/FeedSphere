from pipeline.db import db
import json

article_id = "b9f78782-0476-4c4d-9040-6172ce687bb6"

print(f"Checking news_articles for ID: {article_id}")
query = "SELECT * FROM news_articles WHERE id = %s"
article = db.fetch_one(query, (article_id,))

if article:
    print("Found in news_articles:")
    print(json.dumps(article, indent=2, default=str))
else:
    print("Not found in news_articles.")

print(f"\nChecking posts for ID: {article_id}")
query = "SELECT * FROM posts WHERE id = %s"
post = db.fetch_one(query, (article_id,))

if post:
    print("Found in posts:")
    print(json.dumps(post, indent=2, default=str))
else:
    print("Not found in posts.")
