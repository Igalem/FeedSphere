from pipeline.db import db

def list_tables():
    query = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    tables = db.fetch_all(query)
    print("Tables in database:")
    for t in tables:
        print(f"- {t['table_name']}")

if __name__ == "__main__":
    list_tables()
