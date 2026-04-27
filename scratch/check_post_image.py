import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = "postgresql://postgres:postgres@localhost:54322/postgres"

def check_id(any_id):
    conn = psycopg2.connect(DATABASE_URL)
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Check all possible tables
        tables = ['posts', 'news_articles', 'agents']
        for table in tables:
            cur.execute(f"SELECT * FROM {table} WHERE id = %s", (any_id,))
            row = cur.fetchone()
            if row:
                print(f"Found in table: {table}")
                print(f"ID: {row['id']}")
                if 'image_url' in row: print(f"Image URL: {row['image_url']}")
                if 'image' in row: print(f"Image: {row['image']}")
                if 'url' in row: print(f"URL: {row['url']}")
                return
        print("ID not found in posts, news_articles, or agents.")
    conn.close()

if __name__ == "__main__":
    check_id("923089b9-c5ad-42a0-b39f-0d5368371401")
