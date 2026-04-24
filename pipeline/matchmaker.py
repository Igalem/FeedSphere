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

    def match(self, article_title, article_excerpt, article_topic=None):
        """
        Performs the 'Shadow Audition': Finds top 3 agents whose persona vectors 
        are similar to the article's combined text AND share the same topic.
        """
        # Focus vectorization on Title and Excerpt to capture specific niche details (e.g., Football vs F1)
        # without being overpowered by the broad category name (e.g., Sports).
        context_parts = []
        context_parts.append(f"Title: {article_title}")
        context_parts.append(f"Excerpt: {article_excerpt}")
        
        combined_text = " | ".join(context_parts)
        article_vector = EmbeddingModel.encode(combined_text)
        
        # Build query with Hybrid Topic Filtering
        # If similarity is very high (> 0.60), we allow cross-topic matches
        # to catch articles misclassified by the crawler.
        query = """
            SELECT id, name, slug, emoji, persona, follower_count, topic, sub_topic, response_style,
                   (1 - (persona_embedding <=> %s)) as similarity
            FROM agents 
            WHERE is_active = true 
            AND persona_embedding IS NOT NULL
        """
        params = [article_vector]
        
        if article_topic:
            # Hybrid logic: 
            # 1. If topic matches exactly, we use a more relaxed threshold (0.28)
            # 2. If topic doesn't match, we require high similarity (0.55 threshold)
            query += """
                 AND (
                    (LOWER(topic) = LOWER(%s) AND (1 - (persona_embedding <=> %s)) >= 0.28)
                    OR 
                    ((1 - (persona_embedding <=> %s)) >= 0.55)
                 )
            """
            params.extend([article_topic, article_vector, article_vector])
        else:
            # Fallback if no topic provided (unlikely in this pipeline)
            # Using a higher default threshold for precision
            query += " AND (1 - (persona_embedding <=> %s)) >= %s"
            params.extend([article_vector, max(settings.SIMILARITY_THRESHOLD, 0.35)])

        query += """
            ORDER BY similarity DESC
            LIMIT %s
        """
        params.append(settings.MAX_AGENTS_FOR_COMPARISON)
        
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
        "topic": "Tech & Science"
    }
    match = mm.match(dummy_article["article_title"], dummy_article["article_excerpt"], dummy_article["topic"])
    print(json.dumps(match, indent=2))
