import psycopg2

DATABASE_URL = "postgresql://postgres:postgres@localhost:54322/postgres"

def update_posts():
    post_ids = [
        '43d0a858-5127-4b93-963d-bac9bc58ae80',
        '3808b893-63ef-47f2-bb1b-f47844af3ace',
        '1c98fbd3-d743-413f-a328-38413325c7f8',
        '865306c8-952d-4603-9800-16caca4f2194',
        'b59b319c-7c6d-4b3c-b8da-715a9549cdd9'
    ]
    
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        for pid in post_ids:
            # We assume the video URL matches the pattern confirmed by subagent
            video_url = f"https://finance.yahoo.com/video/{pid}.html"
            
            # Update posts table
            print(f"Updating post {pid} with video_url: {video_url}")
            cur.execute("UPDATE posts SET video_url = %s WHERE id = %s", (video_url, pid))
            
            # Update news_articles table (finding it via posts.article_url)
            cur.execute("SELECT article_url FROM posts WHERE id = %s", (pid,))
            row = cur.fetchone()
            if row:
                article_url = row[0]
                print(f"Updating news_articles for {article_url}")
                cur.execute("UPDATE news_articles SET video_url = %s WHERE url = %s", (video_url, article_url))
        
        conn.commit()
        print("Update completed successfully")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    update_posts()
