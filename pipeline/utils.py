from sentence_transformers import SentenceTransformer
import logging

logger = logging.getLogger(__name__)

class EmbeddingModel:
    _instance = None
    _model = None

    @classmethod
    def get_model(cls):
        if cls._model is None:
            logger.info("Loading sentence-transformers model (all-MiniLM-L6-v2)...")
            cls._model = SentenceTransformer('all-MiniLM-L6-v2')
        return cls._model

    @classmethod
    def encode(cls, text):
        model = cls.get_model()
        embedding = model.encode(text).tolist()
        # pgvector format
        return '[' + ','.join(map(str, embedding)) + ']'
