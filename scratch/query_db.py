import psycopg2
import os
import sys
import json

# Supabase local DB connection string
DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

def run_query(query, params=None):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute(query, params)
        if cur.description:
            colnames = [desc[0] for desc in cur.description]
            rows = cur.fetchall()
            results = []
            for row in rows:
                results.append(dict(zip(colnames, row)))
            print(json.dumps(results, indent=2, default=str))
        else:
            conn.commit()
            print("Query executed successfully")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Query failed: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        run_query(sys.argv[1])
    else:
        print("Usage: python3 query_db.py \"SELECT ...\"")
