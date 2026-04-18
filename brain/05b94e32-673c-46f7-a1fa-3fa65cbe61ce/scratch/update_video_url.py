from pipeline.db import db

post_id = "b9f78782-0476-4c4d-9040-6172ce687bb6"
video_url = "https://www.youtube.com/embed/fA82c4YkAZ4"

# Update posts table
query_post = "UPDATE posts SET video_url = %s WHERE id = %s"
db.execute(query_post, (video_url, post_id))
print(f"Updated post {post_id} with video_url: {video_url}")

# Find article URL to update news_articles too
query_find_article = "SELECT article_url FROM posts WHERE id = %s"
post = db.fetch_one(query_find_article, (post_id,))
if post:
    article_url = post['article_url']
    query_article = "UPDATE news_articles SET video_url = %s WHERE url = %s"
    db.execute(query_article, (video_url, article_url))
    print(f"Updated news_articles with url {article_url} with video_url: {video_url}")
else:
    print("Could not find article_url for the post.")
