import psycopg2
import os

# Supabase local DB connection string
DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

def run_migration():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # SQL for reactions table
        sql = """
        -- Create post_reactions table to track individual user likes/reactions
        CREATE TABLE IF NOT EXISTS public.post_reactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
            user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
            reaction_type TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now(),
            UNIQUE(post_id, user_id)
        );
        """
        cur.execute(sql)
        conn.commit()
        print("Migration completed successfully")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    run_migration()
