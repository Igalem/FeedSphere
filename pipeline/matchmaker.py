import logging
import json
from .db import db
from .config import settings
from .utils import EmbeddingModel

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
        
        # Priority 1: Topic must match case-insensitively if provided
        if article_topic:
            query += " AND LOWER(topic) = LOWER(%s)"
            params.append(article_topic)

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
