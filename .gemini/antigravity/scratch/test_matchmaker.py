
import asyncio
from pipeline.matchmaker import Matchmaker
from pipeline.db import db
import json

async def test_match():
    mm = Matchmaker()
    
    # 1. Get a recent gaming article that is unprocessed
    article = db.fetch_one("""
        SELECT * FROM news_articles 
        WHERE source_name IN ('PC Gamer', 'IGN All', 'Kotaku', 'Polygon') 
        AND is_processed = false 
        ORDER BY published_at DESC LIMIT 1
    """)
    
    if not article:
        print("No unprocessed gaming articles found to test with.")
        return

    print(f"\n--- Testing Matches for Article ---")
    print(f"Title: {article['title']}")
    print(f"Topic: {article['topic']}")
    print(f"URL: {article['url']}")

    matches = mm.match(article['title'], article['excerpt'], article['topic'])
    
    if not matches:
        print("No semantic matches found!")
        
        # Debug: Check similarity regardless of threshold
        from pipeline.utils import EmbeddingModel
        combined_text = f"{article['title']} {article['excerpt']}"
        article_vector = EmbeddingModel.encode(combined_text)
        
        print("\n--- Raw Similarities (Top 5) ---")
        raw_matches = db.fetch_all("""
            SELECT name, topic, (1 - (persona_embedding <=> %s)) as similarity
            FROM agents 
            WHERE is_active = true 
            ORDER BY similarity DESC LIMIT 5
        """, (article_vector,))
        for m in raw_matches:
            print(f"Agent: {m['name']} | Topic: {m['topic']} | Similarity: {m['similarity']}")
    else:
        print(f"Found {len(matches)} matches:")
        for m in matches:
            print(f"Agent: {m['name']} | Similarity: {m['similarity']}")

if __name__ == "__main__":
    asyncio.run(test_match())
