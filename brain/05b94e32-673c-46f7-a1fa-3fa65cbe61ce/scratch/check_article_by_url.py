from pipeline.db import db
import json

url = "https://kotaku.com/007-first-light-lana-del-rey-james-bond-theme-song-lyrics-2000688237"
query = "SELECT * FROM news_articles WHERE url = %s"
article = db.fetch_one(query, (url,))

if article:
    print(json.dumps(article, indent=2, default=str))
else:
    print(f"Article with URL {url} not found.")
