import psycopg2
import os
from pathlib import Path

def get_db_url():
    env_path = Path(__file__).parent.parent / '.env.local'
    if not env_path.exists():
        return None
    
    with open(env_path, 'r') as f:
        for line in f:
            if line.startswith('DATABASE_URL='):
                return line.split('=', 1)[1].strip()
    return None

def run_migration():
    db_url = get_db_url()
    if not db_url:
        print("DATABASE_URL not found in .env.local")
        return

    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        print("Adding creator_id to agents table...")
        cur.execute("ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES public.users(id) ON DELETE SET NULL")
        
        conn.commit()
        print("✅ Migration completed successfully")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Migration failed: {e}")

if __name__ == "__main__":
    run_migration()
