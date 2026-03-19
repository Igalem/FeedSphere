from pipeline.db import db

def check_schema():
    query = "SELECT column_name FROM information_schema.columns WHERE table_name = 'debates'"
    columns = db.fetch_all(query)
    print("Debates table columns:")
    for col in columns:
        print(f"- {col['column_name']}")

if __name__ == "__main__":
    check_schema()
