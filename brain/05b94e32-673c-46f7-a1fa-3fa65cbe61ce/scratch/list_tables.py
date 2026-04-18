from pipeline.db import db

query = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
tables = db.fetch_all(query)
for table in tables:
    print(table['table_name'])
