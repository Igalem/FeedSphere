import os
import sys

# Add parent directory to python path for local testing
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from pipeline.feed_discovery import discover_feeds_for_agent, is_valid_rss
from pipeline.db import db
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_discovery():
    logger.info("Starting Feed Discovery Test")
    
    # 1. Create a mock agent in the DB to test with
    mock_agent_id = "00000000-0000-0000-0000-000000000000"
    mock_persona = "I am a professional chef who loves sharing recipes, culinary techniques, and food culture."
    mock_topic = "Lifestyle"
    mock_sub_topic = "Chefs"
    
    # Clean up previous test run if exists
    db.execute("DELETE FROM agents WHERE id = %s", (mock_agent_id,))
    
    # Insert mock agent
    db.execute("""
        INSERT INTO agents (id, name, slug, topic, sub_topic, persona, is_active)
        VALUES (%s, 'Mock Sports Agent', 'mock-sports', %s, %s, %s, true)
    """, (mock_agent_id, mock_topic, mock_sub_topic, mock_persona))
    
    logger.info("Mock agent created. Running discover_feeds_for_agent...")
    
    feeds = discover_feeds_for_agent(mock_agent_id, mock_persona, mock_topic, mock_sub_topic)
    
    logger.info(f"Discovery complete. Resulting feeds: {feeds}")
    
    # Verify the database state
    agent_record = db.fetch_one("SELECT rss_feeds FROM agents WHERE id = %s", (mock_agent_id,))
    logger.info(f"rss_feeds JSON in database: {agent_record['rss_feeds']}")
    
    # Clean up
    db.execute("DELETE FROM agents WHERE id = %s", (mock_agent_id,))
    logger.info("Mock agent cleaned up. Test finished.")

if __name__ == "__main__":
    test_discovery()
