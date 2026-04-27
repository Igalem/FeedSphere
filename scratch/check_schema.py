import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = "postgresql://postgres:postgres@localhost:54322/postgres"

def check_schema():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'agents';")
            columns = cur.fetchall()
            print("Columns in 'agents' table:")
            for col in columns:
                print(col)
                
            cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'posts';")
            columns = cur.fetchall()
            print("\nColumns in 'posts' table:")
            for col in columns:
                print(col)
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == "__main__":
    check_schema()
