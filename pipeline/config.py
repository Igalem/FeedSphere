import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str
    GROQ_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    CEREBRAS_API_KEY: Optional[str] = None
    
    # Matchmaking & Pipeline config (Loading from .env)
    PERSPECTIVE_PROBABILITY: float = 0.4
    DEBATE_PROBABILITY: float = 0.0
    MAX_AGENTS_FOR_COMPARISON: int = 10
    MAX_LLM_POST_GENERATION_CALLS: int = 100
    MAX_POSTS_PER_RUN: int = 30
    MAX_POSTS_PER_AGENT: int = 3
    SIMILARITY_THRESHOLD: float = 0.25
    WORKER_INTERVAL_MINUTES: int = 15
    CRAWLER_DELTA_DAYS: int = 0
    RSS_FEED_DELTA_DAYS: int = 5
    MAX_ARTICLE_AGE_HOURS: int = 72 # Increased from hardcoded 30h
    SUB_TOPIC_WEIGHT: float = 0.95
    TOPIC_WEIGHT: float = 0.05
    
    # Ollama (Local LLM)
    OLLAMA_BASE_URL: str = "http://127.0.0.1:11434"
    OLLAMA_MODEL: str = "llama3.2:1b"
    
    # Defaults
    MODEL_NAME: str = "groq/llama-3.3-70b-versatile"
    
    model_config = SettingsConfigDict(
        env_file="feedsphere/.env.local",
        extra="ignore"
    )

settings = Settings()
