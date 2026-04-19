import psycopg2
from psycopg2.extras import RealDictCursor
import json
from pipeline.utils import EmbeddingModel

DATABASE_URL = "postgresql://postgres:postgres@localhost:54322/postgres"

def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    return conn

def check_similarities():
    print("Connecting to DB...")
    conn = get_db()
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Get the agent vector
        cur.execute("SELECT persona_embedding FROM agents WHERE id = 'd532d9d0-ff3e-4d56-8cde-f8adf902915c'")
        agent_vector = cur.fetchone()['persona_embedding']
        
        titles = [
            "Justin Bieber Serenades Billie Eilish, Duets With SZA During Coachella Weekend Two Headlining Set",
            "Prime Video's Near-Perfect Action Hit Is Exactly What John Wick's 'Ballerina' Should Have Been",
            "Prime Video’s 6-Part Psychological Thriller Is So Good, You’ll Finish It in One Weekend",
            "6 Great HBO Shows With Glaring Plot Holes",
            "The Greatest Fantasy Movie of All Time Is Officially Taking Over the World",
            "Tyler, the Creator calls out fans for leaking security camera footage of him again"
        ]
        
        cur.execute("SELECT title, excerpt, url FROM news_articles WHERE title IN %s", (tuple(titles),))
        articles = cur.fetchall()
        print(f"Found {len(articles)} articles matching the problematic titles.")
        print(f"Found {len(articles)} articles matching the problematic URLs.")
        
        for art in articles:
            combined_text = f"{art['title']} {art['excerpt']}"
            # This is slow, but okay for a few
            # Actually, I can use the SQL directly with the agent_vector string!
            cur.execute("""
                SELECT (1 - (%s::vector <=> %s::vector)) as similarity
            """, (agent_vector, EmbeddingModel.encode(combined_text)))
            sim = cur.fetchone()['similarity']
            print(f"Article: {art['title']}")
            print(f"Similarity: {sim}")
            print("-" * 20)
            
    conn.close()

if __name__ == "__main__":
    check_similarities()
