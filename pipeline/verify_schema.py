from pipeline.db import db
import json

def verify():
    print("--- news_articles Schema Verification ---")
    columns = db.fetch_all("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'news_articles'
        ORDER BY ordinal_position
    """)
    for col in columns:
        print(f"{col['column_name']} | {col['data_type']}")
    
    print("\n--- news_articles Data Verification ---")
    count = db.fetch_all("SELECT count(*) FROM news_articles")[0]['count']
    print(f"Total articles: {count}")
    
    samples = db.fetch_all("""
        SELECT title, source_name, published_at 
        FROM news_articles 
        WHERE published_at IS NOT NULL 
        LIMIT 3
    """)
    for s in samples:
        print(f"Title: {s['title']}")
        print(f"Source: {s['source_name']}")
        print(f"Published At: {s['published_at']}")
        print("-" * 20)

if __name__ == "__main__":
    verify()
