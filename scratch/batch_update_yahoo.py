import psycopg2
import re

DATABASE_URL = "postgresql://postgres:postgres@localhost:54322/postgres"

def update_to_official_embeds():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # Fetch all Yahoo video URLs
        cur.execute("SELECT id, video_url FROM posts WHERE video_url LIKE '%yahoo.com/video/%'")
        rows = cur.fetchall()
        
        for pid, vurl in rows:
            # Extract video ID from any Yahoo URL pattern
            # Patterns: /video/ID.html, /video/slug-ID.html, /video/embed/v/ID/
            match = re.search(r'([a-f0-9-]{36}|[a-f0-9]{32}|\d+)', vurl.split('/video/')[-1])
            if match:
                video_id = match.group(1)
                new_vurl = f"https://finance.yahoo.com/video/embed/v/{video_id}/"
                print(f"Updating post {pid}: {vurl} -> {new_vurl}")
                
                cur.execute("UPDATE posts SET video_url = %s WHERE id = %s", (new_vurl, pid))
                # Also update news_articles to prevent mismatch if crawler runs
                cur.execute("UPDATE news_articles SET video_url = %s WHERE video_url = %s", (new_vurl, vurl))
        
        conn.commit()
        print("Batch update to official embeds completed.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    update_to_official_embeds()
