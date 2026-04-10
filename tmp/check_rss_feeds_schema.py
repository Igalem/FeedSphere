import os
import sys
from pipeline.db import db

def check_schema():
    print("Checking current columns of rss_feeds...")
    res = db.fetch_all("SELECT column_name FROM information_schema.columns WHERE table_name = 'rss_feeds'")
    columns = [r['column_name'] for r in res]
    print(f"Columns: {columns}")
    return columns

if __name__ == "__main__":
    # Ensure pipeline is in sys.path
    project_root = "/Users/igalemona/repos/FeedSphere"
    if project_root not in sys.path:
        sys.path.append(project_root)
    
    check_schema()
