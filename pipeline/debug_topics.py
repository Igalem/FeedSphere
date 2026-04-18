from pipeline.db import db

print("--- AGENT TOPICS ---")
agents = db.fetch_all("SELECT DISTINCT topic FROM agents WHERE is_active = true")
for a in agents:
    print(f"- {a['topic']}")

print("\n--- RECENT PROCESSED ARTICLE TOPICS ---")
articles = db.fetch_all("SELECT title, topic FROM news_articles WHERE is_processed = true ORDER BY published_at DESC LIMIT 20")
for a in articles:
    print(f"- {a['topic']}: {a['title']}")

print("\n--- SIMILARITY CHECK ---")
# Check if persona_embedding is null
count_null = db.fetch_one("SELECT COUNT(*) FROM agents WHERE persona_embedding IS NULL AND is_active = true")
print(f"Agents with NULL persona_embedding: {count_null['count']}")
