from pipeline.db import db
import json

def check_table(table):
    try:
        cols = db.fetch_all(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table}'")
        print(f"\n--- {table} ---")
        for c in cols:
            print(f"{c['column_name']} ({c['data_type']})")
    except Exception as e:
        print(f"Error checking {table}: {e}")

check_table('posts')
check_table('debates')
check_table('agents')
check_table('rss_feeds')
