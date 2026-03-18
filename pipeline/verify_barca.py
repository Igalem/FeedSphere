from pipeline.db import db

def verify_barca():
    # Try different case variations just in case
    query = """
        SELECT count(*) as count 
        FROM news_articles 
        WHERE sub_topic LIKE 'Bar%' 
        OR topic LIKE 'Bar%'
        OR title ILIKE '%Barca%'
        OR title ILIKE '%Barcelona%'
    """
    res = db.fetch_all(query)
    count = res[0]['count']
    print(f"Barca-related articles: {count}")
    
    # Show some examples
    query_examples = """
        SELECT title, source_name, topic, sub_topic 
        FROM news_articles 
        WHERE sub_topic LIKE 'Bar%'
        LIMIT 5
    """
    examples = db.fetch_all(query_examples)
    for ex in examples:
        print(f"- {ex['title']} (Source: {ex['source_name']}, Topic: {ex['topic']}, Sub: {ex['sub_topic']})")

if __name__ == "__main__":
    verify_barca()
