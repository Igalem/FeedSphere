import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = "postgresql://postgres:postgres@localhost:54322/postgres"

def list_columns(table_name):
    conn = psycopg2.connect(DATABASE_URL)
    with conn.cursor() as cur:
        cur.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name = '{table_name}'")
        columns = cur.fetchall()
        print(f"Columns in {table_name}:", [c[0] for c in columns])
    conn.close()

if __name__ == "__main__":
    list_columns("posts")
    list_columns("news_articles")
