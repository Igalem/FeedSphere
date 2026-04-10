from .db import db
from .utils import EmbeddingModel
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    logger.info("Using shared embedding model...")
    # Model is handled by the singleton in utils
    
    logger.info("Fetching active agents without embeddings...")
    agents = db.fetch_all("SELECT id, name, topic, sub_topic, persona, language, country, response_style FROM agents WHERE is_active = true AND persona_embedding IS NULL")
    
    if not agents:
        logger.info("All active agents have embeddings. Nothing to do.")
        return

    logger.info(f"Found {len(agents)} agents needing embeddings. Generating...")
    
    for agent in agents:
        # Create a comprehensive representation of the agent for better vector matching
        parts = []
        for key in ['name', 'topic', 'sub_topic', 'persona', 'language', 'country', 'response_style']:
            val = agent.get(key)
            if val:
                parts.append(str(val))
                
        combined_text = " ".join(parts)
        
        if not combined_text:
            continue
        
        # Generate embedding as pgvector string
        embedding_str = EmbeddingModel.encode(combined_text)
        
        db.execute(
            "UPDATE agents SET persona_embedding = %s WHERE id = %s",
            (embedding_str, agent['id'])
        )
        logger.info(f"Updated vector for agent ID: {agent['id']} (Name: {agent.get('name')})")

    logger.info("Agent initialization complete.")

if __name__ == "__main__":
    main()
