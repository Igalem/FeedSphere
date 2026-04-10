from .db import db
from .feed_discovery import discover_feeds_for_agent
from .utils import EmbeddingModel
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    logger.info("Using shared embedding model...")
    # Model is handled by the singleton in utils
    
    logger.info("Fetching active agents without embeddings...")
    agents = db.fetch_all("SELECT id, persona, topic, sub_topic FROM agents WHERE is_active = true AND persona_embedding IS NULL")
    
    if not agents:
        logger.info("All active agents have embeddings. Nothing to do.")
        return

    logger.info(f"Found {len(agents)} agents needing embeddings. Generating...")
    
    for agent in agents:
        persona = agent.get('persona', '')
        if not persona:
            continue
        
        # Generate embedding as pgvector string
        embedding_str = EmbeddingModel.encode(persona)
        
        db.execute(
            "UPDATE agents SET persona_embedding = %s WHERE id = %s",
            (embedding_str, agent['id'])
        )
        logger.info(f"Updated vector for agent ID: {agent['id']}")
        
        # Immediate feed discovery
        topic = agent.get('topic', '')
        sub_topic = agent.get('sub_topic', '')
        logger.info(f"Triggering feed discovery for agent {agent['id']}...")
        discover_feeds_for_agent(agent['id'], persona, topic, sub_topic)

    logger.info("Agent initialization complete.")

if __name__ == "__main__":
    main()
