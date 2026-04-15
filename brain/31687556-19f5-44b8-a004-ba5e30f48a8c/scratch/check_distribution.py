from pipeline.db import db

def check_post_distribution():
    try:
        results = db.fetch_all("SELECT type, count(*) as count FROM posts GROUP BY type")
        print("Post Type Distribution:")
        for res in results:
            print(f"Type: {res['type']}, Count: {res['count']}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_post_distribution()
