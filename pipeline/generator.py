import asyncio
import httpx
import logging
import json
import re
import random
from typing import List, Dict, Any, Optional
from tenacity import retry, wait_exponential, stop_after_attempt
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import SystemMessage, HumanMessage
from .config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global session tracking for failure-based master swapping
current_master = 'cerebras'
master_failure_count = 0

def reset_llm_master():
    global current_master, master_failure_count
    current_master = 'cerebras'
    master_failure_count = 0
    logger.info('🔄 [LLM] Master LLM reset to Cerebras for this run.')

class Generator:
    def __init__(self):
        # We don't initialize a single LLM here anymore because we'll use different providers based on fallback logic
        # Limit concurrency to avoid rate limits
        self.semaphore = asyncio.Semaphore(2)
        
        self.reaction_prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an AI agent with the following persona: {persona}"),
            ("user", "Write a reactive post to this news.\n\n"
                     "Title: {article_title}\n"
                     "Excerpt: {article_excerpt}\n\n"
                     "Rules:\n"
                     "1. Use your unique voice: {response_style}.\n"
                     "2. Provide a detailed reaction with a variety of word counts across different posts.\n"
                     "3. Keep it concise, maximum 3 rows/lines of text.\n"
                     "4. Output format: JSON object with 'agent_commentary' (string), 'sentiment_score' (number 0-100), and 'tags' (array of 3 high-level PascalCase strings).\n"
                     "5. Tags MUST be one-word PascalCase (e.g., 'MarchMadness', 'NFLNews', 'SportsAnalysis'). No spaces.\n\n"
                     "IMPORTANT: Return ONLY a valid JSON object. Do NOT return a list or set of strings. Be expressive with the sentiment_score (0=Extremely Critical, 50=Neutral, 100=Extremely Bullish). Example: {{\"agent_commentary\": \"...\", \"sentiment_score\": 85, \"tags\": [\"...\", \"...\"]}}")
        ])

        self.perspective_prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an AI agent with the following persona: {persona}"),
            ("user", "Write a deep, insightful perspective on this news item.\n\n"
                     "Title: {article_title}\n"
                     "Excerpt: {article_excerpt}\n"
                     "Image Context: This article includes a striking image.\n\n"
                     "Rules:\n"
                     "1. Provide a unique point of view based on your persona.\n"
                     "2. References the significance of the event.\n"
                     "3. Output format: JSON object with 'agent_commentary' (string), 'sentiment_score' (number 0-100), and 'tags' (array of 3 high-level PascalCase strings).\n"
                     "4. Tags MUST be one-word PascalCase (e.g., 'GlobalEconomy', 'TechInnovation', 'ClimatePulse'). No spaces.\n\n"
                     "IMPORTANT: Return ONLY a valid JSON object. Do NOT return a list or set of strings. Be expressive with the sentiment_score (0=Extremely Critical, 50=Neutral, 100=Extremely Bullish). Example: {{\"agent_commentary\": \"...\", \"sentiment_score\": 15, \"tags\": [\"...\", \"...\"]}}")
        ])

        self.debate_prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an expert debate moderator."),
            ("user", "Create a heated, 2-agent debate based on this news article.\n\n"
                     "Article Title: {article_title}\n"
                     "Article Excerpt: {article_excerpt}\n\n"
                     "Agent A Persona: {persona_a}\n"
                     "Agent B Persona: {persona_b}\n\n"
                     "Rules:\n"
                     "1. Tags MUST be one-word PascalCase (e.g., 'DebatePulse', 'TopicWar').\n"
                     "2. Be expressive with sentiment values (0-100). Avoid defaulting to 50 if the agent has a clear stance.\n\n"
                     "Output Format (JSON):\n"
                     "{{\n"
                     "  \"argument_a\": \"2-sentence argument from Agent A's perspective\",\n"
                     "  \"sentiment_a\": 85,\n"
                     "  \"argument_b\": \"2-sentence counter-argument from Agent B using their unique voice\",\n"
                     "  \"sentiment_b\": 20,\n"
                     "  \"debate_question\": \"A provocative question for the audience\",\n"
                     "  \"tags\": [\"TagA\", \"TagB\", \"TagC\"]\n"
                     "}}\n\n"
                     "IMPORTANT: Return ONLY valid JSON.")
        ])

        self.relevancy_prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an intelligent Relevancy Filter for an AI agent's news feed. "
                       "Agent Topic: {topic}\n"
                       "Agent Specific Niche: {sub_topic}\n"
                       "Agent Persona: {persona}"),
            ("user", "Determine how relevant this article is to the agent's specific niche and persona.\n\n"
                     "Article Title: {article_title}\n"
                     "Article Excerpt: {article_excerpt}\n\n"
                     "Scoring Rules:\n"
                     "1. 100: Perfect match (e.g. Agent niche is 'FC Barcelona' and Article is about Barca).\n"
                     "2. 80-99: Very high relevance (e.g. Agent is Barca, Article is about Laliga rivals or transfers affecting Barca).\n"
                     "3. 60-79: Strong topical relevance (e.g. Agent is Barca, Article is about general Spanish football).\n"
                     "4. 0-59: Weak or no relevance (e.g. Agent is Barca, Article is about Golf or Finance).\n\n"
                     "Output Format: JSON object with 'relevance_score' (number 0-100) and 'is_relevant' (boolean, true if score >= 60).\n"
                     "IMPORTANT: Return ONLY valid JSON.")
        ])

    async def _generate_llm_response(self, prompt: ChatPromptTemplate, values: Dict[str, Any], is_json: bool = False, force_provider: Optional[str] = None) -> str:
        global current_master, master_failure_count
        
        # Decide order based on current master and request type
        # For relevancy gating: we force Ollama first.
        # For posting: Cerebras → Gemini → Groq
        cloud_flow = ['cerebras', 'gemini', 'groq']
        
        if force_provider:
            # Case: High-volume check (Ollama) or specific provider forced
            providers = [force_provider] + [p for p in cloud_flow if p != force_provider]
        elif current_master == 'groq':
            providers = ['groq', 'cerebras', 'gemini', 'ollama']
        elif current_master == 'gemini':
            providers = ['gemini', 'cerebras', 'groq', 'ollama']
        else:
            # Default flow: Cerebras → Gemini → Groq
            providers = ['cerebras', 'gemini', 'groq', 'ollama']
            
        messages = prompt.format_messages(**values)
        
        last_exception = None
        
        for provider in providers:
            try:
                if provider == 'ollama':
                    if not settings.OLLAMA_BASE_URL:
                        continue
                    try:
                        logger.info(f"[LLM] Trying Ollama ({settings.OLLAMA_MODEL})...")
                        async with httpx.AsyncClient(timeout=30) as client:
                            # Map LangChain roles to Ollama roles
                            role_map = {"system": "system", "human": "user", "ai": "assistant"}
                            ollama_messages = [
                                {"role": role_map.get(m.type, "user"), "content": m.content} 
                                for m in messages
                            ]
                            
                            data = {
                                "model": settings.OLLAMA_MODEL,
                                "messages": ollama_messages,
                                "stream": False
                            }
                            if is_json:
                                data["format"] = "json"
                                
                            resp = await client.post(f"{settings.OLLAMA_BASE_URL}/api/chat", json=data)
                            resp.raise_for_status()
                            result = resp.json()
                            content = result.get('message', {}).get('content', '').strip()
                            if content:
                                return content
                            raise Exception("Empty response from Ollama")
                    except Exception as e:
                        if force_provider == 'ollama':
                            # If explicitly forced (e.g. relevancy check), we allow it to proceed to backups
                            # unless we want a hard fail. The user's goal was volume. 
                            # Let's log and continue to standard backups.
                            logger.warning(f"[LLM] Ollama failed: {e}. Falling back to cloud...")
                            # Re-add standard providers to the loop if we were forcing ollama
                            # Actually, the loop will just continue if we don't break.
                            # But wait, if providers = ['ollama'], it will exit.
                            # Let's fix providers list if ollama was forced and fails.
                            providers = ['cerebras', 'gemini', 'groq']
                            continue
                        logger.warning(f"[LLM] Ollama check failed or not running: {e}")
                        continue

                elif provider == 'cerebras':
                    if not settings.CEREBRAS_API_KEY:
                        continue
                    logger.info(f"[LLM] Trying Cerebras (Master: {current_master})...")
                    llm = ChatOpenAI(
                        api_key=settings.CEREBRAS_API_KEY,
                        base_url="https://api.cerebras.ai/v1",
                        model="llama3.1-8b",
                        temperature=0.8,
                        max_tokens=1000,
                        timeout=30
                    )
                    
                elif provider == 'groq':
                    if not settings.GROQ_API_KEY:
                        continue
                    logger.info(f"[LLM] Trying Groq (Master: {current_master})...")
                    llm = ChatGroq(
                        api_key=settings.GROQ_API_KEY,
                        model="llama-3.3-70b-versatile",
                        temperature=0.8,
                        max_tokens=1000,
                        timeout=30
                    )
                    
                elif provider == 'gemini':
                    if not settings.GEMINI_API_KEY:
                        continue
                    logger.info(f"[LLM] Trying Gemini (Master: {current_master})...")
                    llm = ChatGoogleGenerativeAI(
                        google_api_key=settings.GEMINI_API_KEY,
                        model="gemini-2.0-flash-lite", # Using the name from lib/llm.js
                        temperature=0.8,
                        max_tokens=1000,
                        timeout=30
                    )
                
                async with self.semaphore:
                    response = await llm.ainvoke(messages)
                    content = response.content.strip()
                    if content:
                        return content
                    raise Exception(f"Empty response from {provider}")
                    
            except Exception as e:
                logger.warning(f"[LLM] {provider.capitalize()} failed: {str(e)}")
                last_exception = e
                
                # Check for master failure logic
                if provider == current_master:
                    master_failure_count += 1
                    logger.warning(f"⚠️ [LLM] Master ({current_master}) failure count: {master_failure_count}/3")
                    if master_failure_count >= 3:
                        if current_master == 'cerebras':
                            current_master = 'groq'
                        elif current_master == 'groq':
                            current_master = 'gemini'
                        else:
                            current_master = 'cerebras' # Reset or stay
                        master_failure_count = 0
                        logger.error(f"🚨 [LLM] Master failed 3 times. SWAPPING MASTER TO {current_master.upper()} for rest of session.")
                
                continue
        
        raise last_exception or Exception("All LLM providers and backups failed")

    def _clean_json_response(self, content: str) -> str:
        """Cleans potentially markdown-wrapped JSON or extra text around JSON."""
        # Find the first { - we assume the first json object is what we want
        start_idx = content.find('{')
        if start_idx == -1:
            return content.strip()
        
        # Try to find the matching } for the FIRST valid object
        try:
            # We'll try to find the actual end of the JSON object by tracking braces
            brace_count = 0
            in_string = False
            escape = False
            end_idx = -1
            
            for i in range(start_idx, len(content)):
                char = content[i]
                if char == '"' and not escape:
                    in_string = not in_string
                elif char == '\\' and in_string:
                    escape = not escape
                    continue
                elif not in_string:
                    if char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            end_idx = i + 1
                            break
                escape = False
                
            if end_idx != -1:
                json_str = content[start_idx:end_idx]
                
                # Pre-processing to handle internal unescaped double quotes in commentary
                # This is a heuristic: if we see "agent_commentary": "..." and there are 
                # quotes in the middle that aren't followed by , or } they might be unescaped content.
                # However, a better way is to just let the fallback regex handle the worst cases.
                
                # 1. Handle "Invalid control character" (raw newlines in strings)
                def escape_control_chars(match):
                    s = match.group(0)
                    return s.replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')
                
                json_str = re.sub(r'"(?:\\.|[^"\\])*"', escape_control_chars, json_str, flags=re.DOTALL)

                # 2. Handle "set-like" notation: {"a", "b"}
                temp_str = re.sub(r'"(?:\\.|[^"\\])*"', '', json_str)
                if ":" not in temp_str:
                    parts = re.findall(r'"((?:\\.|[^"\\])*)"', json_str, re.DOTALL)
                    if parts:
                        joined = " ".join(parts)
                        return json.dumps({"agent_commentary": joined, "tags": []})
                
                return json_str

        except Exception as e:
            logger.warning(f"Error in _clean_json_response helper: {e}")
            pass

        return content.strip()

    def _clean_commentary(self, text: str) -> str:
        """Removes unwanted characters and emojis (specifically 🇮🇱)."""
        if not text:
            return ""
        # Remove Israel flag
        text = text.replace('🇮🇱', '')
        # Clean up any residual double spaces or leading/trailing whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    def _format_tag(self, tag: str) -> str:
        """Formats a tag to PascalCase and removes non-alphanumeric chars."""
        # Split by spaces, hyphens, or underscores
        words = re.split(r'[\s\-_]+', tag)
        # Capitalize each word and join
        clean_words = [re.sub(r'\W+', '', word.capitalize()) for word in words]
        return "".join(clean_words)

    @retry(wait=wait_exponential(multiplier=1, min=2, max=6), stop=stop_after_attempt(3))
    async def get_relevancy_score(self, agent: Dict, article: Dict) -> int:
        """Determines if the article is topically relevant to the agent using the LLM Gatekeeper."""
        logger.info(f"Running LLM Relevancy Gatekeeper for agent: {agent['slug']} against article: {article['article_title']}")
        
        content = await self._generate_llm_response(self.relevancy_prompt, {
            "topic": agent.get("topic", "General"),
            "sub_topic": agent.get("sub_topic", "N/A"),
            "persona": agent["persona"],
            "article_title": article["article_title"],
            "article_excerpt": article["article_excerpt"]
        }, is_json=True, force_provider="ollama")
        
        try:
            json_str = self._clean_json_response(content)
            data = json.loads(json_str)
            return int(data.get("relevance_score", 0))
        except Exception as e:
            logger.error(f"Failed to parse relevancy score JSON: {e}, Content: {content}")
            return 80 # Default to high relevance if parsing fails to avoid dropping good content

    @retry(wait=wait_exponential(multiplier=1, min=4, max=10), stop=stop_after_attempt(5))
    async def generate_reaction(self, agent: Dict, article: Dict) -> Dict:
        """Generates a standard short reaction post."""
        logger.info(f"Generating reaction for agent: {agent['slug']}")
        
        content = await self._generate_llm_response(self.reaction_prompt, {
            "persona": agent["persona"],
            "response_style": agent.get("response_style", "Punchy and direct"),
            "article_title": article["article_title"],
            "article_excerpt": article["article_excerpt"]
        })
        
        try:
            json_str = self._clean_json_response(content)
            data = json.loads(json_str)
            
            # Post-process tags
            tags = [self._format_tag(t) for t in data.get("tags", [])]
            # Limit to 3-5 tags
            tags = tags[:5]
            
            return {
                "type": "reaction",
                "agent_id": agent["id"],
                "article_title": article["article_title"],
                "article_url": article["article_url"],
                "article_excerpt": article["article_excerpt"],
                "article_image_url": article.get("article_image_url"),
                "source_name": article["source_name"],
                "agent_commentary": self._clean_commentary(data.get("agent_commentary", "")),
                "sentiment_score": data.get("sentiment_score", 50),
                "tags": tags,
                "published_at": article.get("published_at")
            }
        except Exception as e:
            # Fallback but attempt to clean up JSON if it looks like one
            if "agent_commentary" in content:
                # Use a lookahead to find the closing quote of the commentary field
                # that is followed by the next field (tags) or the end object
                commentary_match = re.search(r'"agent_commentary":\s*"(.*)"(?=\s*,\s*"tags"|\s*\})', content, re.DOTALL)
                commentary = commentary_match.group(1) if commentary_match else content
                return {
                    "type": "reaction",
                    "agent_id": agent["id"],
                    "article_title": article["article_title"],
                    "article_url": article["article_url"],
                    "article_excerpt": article["article_excerpt"],
                    "article_image_url": article.get("article_image_url"),
                    "source_name": article["source_name"],
                    "agent_commentary": self._clean_commentary(commentary),
                    "sentiment_score": 50,
                    "tags": [],
                    "published_at": article.get("published_at")
                }
            
            logger.error(f"Failed to parse reaction JSON: {e}")
            logger.error(f"Raw content that failed to parse: {content}")
            return {
                "type": "reaction",
                "agent_id": agent["id"],
                "article_title": article["article_title"],
                "article_url": article["article_url"],
                "article_excerpt": article["article_excerpt"],
                "article_image_url": article.get("article_image_url"),
                "source_name": article["source_name"],
                "agent_commentary": self._clean_commentary(content),
                "sentiment_score": 50,
                "tags": [],
                "published_at": article.get("published_at")
            }

    @retry(wait=wait_exponential(multiplier=1, min=4, max=10), stop=stop_after_attempt(5))
    async def generate_perspective(self, agent: Dict, article: Dict) -> Dict:
        """Generates a deeper perspective post."""
        logger.info(f"Generating perspective for agent: {agent['slug']}")
        
        content = await self._generate_llm_response(self.perspective_prompt, {
            "persona": agent["persona"],
            "article_title": article["article_title"],
            "article_excerpt": article["article_excerpt"]
        })
        
        try:
            json_str = self._clean_json_response(content)
            data = json.loads(json_str)
            
            # Post-process tags
            tags = [self._format_tag(t) for t in data.get("tags", [])]
            tags = tags[:5]

            return {
                "type": "perspective",
                "agent_id": agent["id"],
                "article_title": article["article_title"],
                "article_url": article["article_url"],
                "article_excerpt": article["article_excerpt"],
                "article_image_url": article.get("article_image_url"),
                "source_name": article["source_name"],
                "agent_commentary": self._clean_commentary(data.get("agent_commentary", "")),
                "sentiment_score": data.get("sentiment_score", 50),
                "tags": tags,
                "published_at": article.get("published_at")
            }
        except Exception as e:
            if "agent_commentary" in content:
                # Use a lookahead to find the closing quote of the commentary field
                # that is followed by the next field (tags) or the end object
                commentary_match = re.search(r'"agent_commentary":\s*"(.*)"(?=\s*,\s*"tags"|\s*\})', content, re.DOTALL)
                commentary = commentary_match.group(1) if commentary_match else content
                return {
                    "type": "perspective",
                    "agent_id": agent["id"],
                    "article_title": article["article_title"],
                    "article_url": article["article_url"],
                    "article_excerpt": article["article_excerpt"],
                    "article_image_url": article.get("article_image_url"),
                    "source_name": article["source_name"],
                    "agent_commentary": self._clean_commentary(commentary),
                    "sentiment_score": 50,
                    "tags": [],
                    "published_at": article.get("published_at")
                }
            
            logger.error(f"Failed to parse perspective JSON: {e}")
            logger.error(f"Raw content that failed to parse: {content}")
            return {
                "type": "perspective",
                "agent_id": agent["id"],
                "article_title": article["article_title"],
                "article_url": article["article_url"],
                "article_excerpt": article["article_excerpt"],
                "article_image_url": article.get("article_image_url"),
                "source_name": article["source_name"],
                "agent_commentary": self._clean_commentary(content),
                "sentiment_score": 50,
                "tags": [],
                "published_at": article.get("published_at")
            }

    @retry(wait=wait_exponential(multiplier=1, min=4, max=10), stop=stop_after_attempt(5))
    async def generate_debate(self, agent_a: Dict, agent_b: Dict, article: Dict) -> Dict:
        """Generates a debate between two agents."""
        logger.info(f"Generating debate between {agent_a['slug']} and {agent_b['slug']}")
        
        content = await self._generate_llm_response(self.debate_prompt, {
            "article_title": article["article_title"],
            "article_excerpt": article["article_excerpt"],
            "persona_a": agent_a["persona"],
            "persona_b": agent_b["persona"]
        }, is_json=True)
        
        try:
            json_str = self._clean_json_response(content)
            data = json.loads(json_str)
            
            # Post-process tags
            tags = [self._format_tag(t) for t in data.get("tags", [])]
            tags = tags[:5]

            return {
                "type": "debate",
                "topic": article["topic"],
                "article_title": article["article_title"],
                "article_url": article["article_url"],
                "article_image_url": article.get("article_image_url"),
                "article_excerpt": article["article_excerpt"],
                "agent_a_id": agent_a["id"],
                "agent_b_id": agent_b["id"],
                "argument_a": self._clean_commentary(data["argument_a"]),
                "sentiment_a": data.get("sentiment_a", 50),
                "argument_b": self._clean_commentary(data["argument_b"]),
                "sentiment_b": data.get("sentiment_b", 50),
                "debate_question": self._clean_commentary(data["debate_question"]),
                "tags": tags,
                "published_at": article.get("published_at")
            }
        except Exception as e:
            logger.error(f"Failed to parse debate JSON: {e}")
            return None


    async def generate_all(self, matches: List[Dict]) -> List[Dict]:
        return matches

if __name__ == "__main__":
    import json
    async def test():
        gen = Generator()
        dummy_match = {
            "article": {
                "article_title": "The Future of AI Sports",
                "article_url": "http://example.com",
                "article_excerpt": "AI is changing how we watch and play sports...",
                "topic": "Sports",
                "sub_topic": "Analysis",
                "source_name": "Test News"
            },
            "agents": [
                {"id": 1, "slug": "sports-oracle", "persona": "Data obsessed analyst", "response_style": "stat-backed"},
                {"id": 2, "slug": "techpulse", "persona": "Skeptical tech journalist", "response_style": "Dry and skeptical"}
            ]
        }
        # results = await gen.process_match(dummy_match) # process_match was removed or didn't exist in original code as a direct method
        # print(json.dumps(results, indent=2))
        
    # asyncio.run(test())
