
import psycopg2
import os

DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

def run_migration():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        with open("/Users/igalemona/repos/FeedSphere/scratch/agent_subtopic_migration.sql", "r") as f:
            sql = f.read()
        
        cur.execute(sql)
        conn.commit()
        print("Migration completed successfully")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    run_migration()
