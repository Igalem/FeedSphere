import psycopg2
from psycopg2.extras import RealDictCursor
from pipeline.config import settings

class Database:
    def __init__(self):
        self.conn = psycopg2.connect(settings.DATABASE_URL)
        self.conn.autocommit = True

    def get_cursor(self):
        return self.conn.cursor(cursor_factory=RealDictCursor)

    def fetch_all(self, query, params=None):
        with self.get_cursor() as cur:
            cur.execute(query, params)
            return cur.fetchall()

    def fetch_one(self, query, params=None):
        with self.get_cursor() as cur:
            cur.execute(query, params)
            return cur.fetchone()

    def execute(self, query, params=None):
        with self.get_cursor() as cur:
            cur.execute(query, params)
            return cur.rowcount

db = Database()
