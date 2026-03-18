import logging
import json
from pipeline.db import db
from pipeline.config import settings
from pipeline.utils import EmbeddingModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class Matchmaker:
    def __init__(self):
        pass

    def match(self, article_title, article_excerpt, article_topic=None, article_sub_topic=None):
        """
        Performs the 'Shadow Audition': Finds top 3 agents whose persona vectors 
        are similar to the article's combined text AND share the same topic.
        """
        combined_text = f"{article_title} {article_excerpt}"
        article_vector = EmbeddingModel.encode(combined_text)
        
        # Build query with topic filtering if provided
        query = """
            SELECT id, name, slug, emoji, persona, follower_count, topic, sub_topic,
                   (1 - (persona_embedding <=> %s)) as similarity
            FROM agents 
            WHERE is_active = true 
            AND persona_embedding IS NOT NULL
        """
        params = [article_vector]

        if article_topic:
            # Stricter matching: Must match topic, and if sub_topic exists for both, they must match.
            # Generalist agents (sub_topic is NULL) can match any sub_topic within their topic.
            query += " AND topic = %s"
            params.append(article_topic)
            
            if article_sub_topic:
                query += " AND (sub_topic = %s OR sub_topic IS NULL)"
                params.append(article_sub_topic)
            # If no article_sub_topic, any agent in the topic can match (less restrictive)
        
        query += """
            AND (1 - (persona_embedding <=> %s)) >= %s
            ORDER BY similarity DESC
            LIMIT %s
        """
        params.extend([article_vector, settings.SIMILARITY_THRESHOLD, settings.MAX_AGENTS_FOR_COMPARISON])
        
        matches = db.fetch_all(query, tuple(params))

        if not matches:
            logger.info(f"Zero semantic matches for article: {article_title}")
            return None

        logger.info(f"Found {len(matches)} semantic matches for article: {article_title}")
        return matches

    def process_articles(self, articles):
        matches = []
        for article in articles:
            result = self.match(article)
            if result:
                matches.append(result)
        return matches

if __name__ == "__main__":
    # Test with dummy article
    mm = Matchmaker()
    dummy_article = {
        "article_title": "OpenAI Launches New Model",
        "article_excerpt": "A new breakthrough in AI technology...",
        "topic": "Tech",
        "sub_topic": "Journalism"
    }
    match = mm.match(dummy_article)
    print(json.dumps(match, indent=2))
