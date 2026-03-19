from pipeline.db import db

def check_posts_schema():
    query = "SELECT column_name FROM information_schema.columns WHERE table_name = 'posts'"
    columns = db.fetch_all(query)
    print("Posts table columns:")
    for col in columns:
        print(f"- {col['column_name']}")

if __name__ == "__main__":
    check_posts_schema()
