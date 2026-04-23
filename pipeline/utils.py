from sentence_transformers import SentenceTransformer
import logging

logger = logging.getLogger(__name__)

class EmbeddingModel:
    _instance = None
    _model = None

    @classmethod
    def get_model(cls):
        if cls._model is None:
            logger.info("Loading sentence-transformers model (BAAI/bge-m3)...")
            cls._model = SentenceTransformer('BAAI/bge-m3')
        return cls._model

    @classmethod
    def encode(cls, text):
        model = cls.get_model()
        embedding = model.encode(text).tolist()
        # pgvector format
        return '[' + ','.join(map(str, embedding)) + ']'

def sanitize_topic(topic):
    """
    Sanitizes a topic to match one of the 7 core categories.
    Matches the logic in feedsphere/lib/topics.js.
    """
    if not topic:
        return "News & Politics"
    
    lower = topic.lower().strip()
    
    mapping = {
        # News
        'news': 'News & Politics', 'politics': 'News & Politics', 'environment': 'News & Politics', 'climate': 'News & Politics', 'world': 'News & Politics',
        # Tech
        'tech': 'Tech & Science', 'science': 'Tech & Science', 'ai & ethics': 'Tech & Science', 'programming': 'Tech & Science', 'software': 'Tech & Science', 'hardware': 'Tech & Science',
        # Sports
        'sports': 'Sports', 'health': 'Lifestyle & Culture', 'fitness': 'Sports', 'football': 'Sports', 'soccer': 'Sports', 'basketball': 'Sports', 'nba': 'Sports', 'nfl': 'Sports',
        'rugby': 'Sports', 'nrl': 'Sports', 'cricket': 'Sports', 'baseball': 'Sports', 'mlb': 'Sports', 'boxing': 'Sports', 'mma': 'Sports', 'ufc': 'Sports',
        # Entertainment
        'entertainment': 'Entertainment', 'music': 'Entertainment', 'movies': 'Entertainment', 'tv': 'Entertainment', 'culture': 'Entertainment',
        # Gaming
        'gaming': 'Gaming', 'games': 'Gaming', 'esports': 'Gaming',
        # Business
        'finance': 'Business & Money', 'business': 'Business & Money', 'money': 'Business & Money', 'crypto': 'Business & Money', 'real estate': 'Business & Money', 'marketing': 'Business & Money',
        # Lifestyle
        'lifestyle': 'Lifestyle & Culture', 'food': 'Lifestyle & Culture', 'travel': 'Lifestyle & Culture', 'fashion': 'Lifestyle & Culture', 'automotive': 'Lifestyle & Culture', 'cars': 'Lifestyle & Culture', 'decor': 'Lifestyle & Culture', 'recipes': 'Lifestyle & Culture',
        # Knowledge
        'education': 'Knowledge', 'art & design': 'Knowledge', 'history': 'Knowledge', 'books': 'Knowledge'
    }
    
    if lower in mapping:
        return mapping[lower]
    
    # Check for substring matches in core categories
    cores = [
        'News & Politics', 'Tech & Science', 'Sports', 
        'Entertainment', 'Gaming', 'Business & Money', 
        'Lifestyle & Culture', 'Knowledge'
    ]
    
    for core in cores:
        if core.lower() in lower:
            return core
            
    return "News & Politics"
