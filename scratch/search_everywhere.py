import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = "postgresql://postgres:postgres@localhost:54322/postgres"

def search_everywhere(any_id):
    conn = psycopg2.connect(DATABASE_URL)
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
        tables = cur.fetchall()
        for table in tables:
            t_name = table['table_name']
            try:
                cur.execute(f"SELECT * FROM {t_name} WHERE id::text = %s", (any_id,))
                row = cur.fetchone()
                if row:
                    print(f"Found in table: {t_name}")
                    print(row)
                    return
            except Exception:
                pass
    print("ID not found anywhere.")
    conn.close()

if __name__ == "__main__":
    search_everywhere("923089b9-c5ad-42a0-b39f-0d5368371401")
