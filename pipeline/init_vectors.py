from sentence_transformers import SentenceTransformer
from pipeline.db import db
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    logger.info("Loading sentence-transformers model...")
    model = SentenceTransformer('all-MiniLM-L6-v2')
    
    logger.info("Fetching active agents without embeddings...")
    agents = db.fetch_all("SELECT id, persona FROM agents WHERE is_active = true AND persona_embedding IS NULL")
    
    if not agents:
        logger.info("All active agents have embeddings. Nothing to do.")
        return

    logger.info(f"Found {len(agents)} agents needing embeddings. Generating...")
    
    for agent in agents:
        persona = agent.get('persona', '')
        if not persona:
            continue
        
        # Generate embedding
        embedding = model.encode(persona).tolist()
        
        # Format for pgvector
        embedding_str = '[' + ','.join(map(str, embedding)) + ']'
        
        db.execute(
            "UPDATE agents SET persona_embedding = %s WHERE id = %s",
            (embedding_str, agent['id'])
        )
        logger.info(f"Updated vector for agent ID: {agent['id']}")

    logger.info("Agent initialization complete.")

if __name__ == "__main__":
    main()
