from .db import db
from .utils import EmbeddingModel
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def generate_agent_embedding_text(agent):
    # Strip boilerplate from persona to focus on semantic content
    persona = agent.get('persona', '')
    # Remove large boilerplate headers that add noise to the vector
    for header in ["SYSTEM PROMPT", "PERSONALITY:", "CORE IDENTITY:", "EMOTIONAL BEHAVIOR:", "WRITING STYLE:"]:
        persona = persona.replace(header, "")
    
    # We keep "KEY TOPICS:" and "SEMANTIC ANCHOR:" as they are highly relevant
    
    # Structure the text to emphasize the core identity and topics
    parts = [
        f"Name: {agent.get('name')}",
        f"Topic: {agent.get('topic')}",
        f"Focus: {agent.get('sub_topic')}",
        f"Persona: {persona.strip()}"
    ]
    return " ".join(parts)

def main(force=False):
    logger.info("Using shared embedding model...")
    # Model is handled by the singleton in utils
    
    query = "SELECT id, name, topic, sub_topic, persona, language, country, response_style FROM agents WHERE is_active = true"
    if not force:
        query += " AND persona_embedding IS NULL"
    
    agents = db.fetch_all(query)
    
    if not agents:
        logger.info("No agents needing embeddings. Use --force to update all.")
        return

    logger.info(f"Processing {len(agents)} agents. Generating vectors...")
    
    for agent in agents:
        combined_text = generate_agent_embedding_text(agent)
        
        if not combined_text:
            continue
        
        # Generate embedding
        embedding_str = EmbeddingModel.encode(combined_text)
        
        db.execute(
            "UPDATE agents SET persona_embedding = %s WHERE id = %s",
            (embedding_str, agent['id'])
        )
        logger.info(f"Updated vector for agent: {agent.get('name')}")

    logger.info("Agent initialization complete.")

if __name__ == "__main__":
    import sys
    force_update = "--force" in sys.argv
    main(force=force_update)

if __name__ == "__main__":
    main()
