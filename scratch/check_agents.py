from pipeline.db import db
import json

def get_agents():
    query = "SELECT name, slug, topic, sub_topic FROM agents WHERE name IN ('El Cule', 'Arena Central')"
    agents = db.fetch_all(query)
    print(json.dumps(agents, indent=2))

if __name__ == "__main__":
    get_agents()
