
from sentence_transformers import SentenceTransformer
import numpy as np

def cosine_similarity(v1, v2):
    return np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))

model = SentenceTransformer('all-MiniLM-L6-v2')

# Article text
article_text = "Almost 28 years later, the mystery of what's under women's skirts in Elder Scrolls spin-off Redguard has finally been solved"
article_vec = model.encode(article_text)

# Current persona text (approximate)
persona_full = """Gamer 365 Entertainment & Gaming Esports, Gaming, Console SYSTEM PROMPT — Gamer 365 PERSONALITY: A veteran gamer who discusses industry news, speedruns, and game design with religious fervor. CORE IDENTITY: 1. Gameplay is king. 2. Respects indie developers and legacy hardware. KEY TOPICS: Esports, Game Design, Console Wars, Indie Spotlight, Retro Gaming. EMOTIONAL BEHAVIOR: Hyped for innovation, vocal about predatory monetization. WRITING STYLE: Fast-paced, uses gaming jargon, opinionated. SEMANTIC ANCHOR: Playstation Xbox Nintendo Steam Unreal Engine frame rate hitbox speedrun multiplayer esports patch notes graphics gameplay. en en Fast-paced, uses gaming jargon, opinionated."""
vec_full = model.encode(persona_full)
print(f"Similarity (Full): {cosine_similarity(article_vec, vec_full)}")

# Semantic only (Topic + Subtopic + Anchor)
persona_semantic = "Entertainment & Gaming Esports, Gaming, Console Playstation Xbox Nintendo Steam Unreal Engine frame rate hitbox speedrun multiplayer esports patch notes graphics gameplay."
vec_semantic = model.encode(persona_semantic)
print(f"Similarity (Semantic): {cosine_similarity(article_vec, vec_semantic)}")

# Even more focused
persona_focused = "Gaming Elder Scrolls Redguard PlayStation Xbox Nintendo Esports"
vec_focused = model.encode(persona_focused)
print(f"Similarity (Focused): {cosine_similarity(article_vec, vec_focused)}")

# Modern Living for comparison
persona_modern = "SYSTEM PROMPT — Modern Living PERSONALITY: A curator of good taste, slow living, and design. CORE IDENTITY: 1. Life is in the details. 2. Aesthetics and comfort are essential. KEY TOPICS: Design, Travel, Food, Architecture, Fashion. EMOTIONAL BEHAVIOR: Appreciative, warm, grounded. WRITING STYLE: Descriptive, cozy, lifestyle-oriented. SEMANTIC ANCHOR: Architecture interior design travel culinary coffee fashion slow living minimalist home decor vacation aesthetic destination."
vec_modern = model.encode(persona_modern)
print(f"Similarity (Modern Living): {cosine_similarity(article_vec, vec_modern)}")
