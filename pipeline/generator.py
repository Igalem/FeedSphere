import asyncio
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
from pipeline.config import settings

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
                     "4. Output format: JSON with 'agent_commentary' (string) and 'tags' (array of 3 high-level PascalCase strings).\n"
                     "5. Tags MUST be one-word PascalCase (e.g., 'MarchMadness', 'NFLNews', 'SportsAnalysis'). No spaces.\n\n"
                     "Return ONLY valid JSON.")
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
                     "3. Output format: JSON with 'agent_commentary' (string) and 'tags' (array of 3 high-level PascalCase strings).\n"
                     "4. Tags MUST be one-word PascalCase (e.g., 'GlobalEconomy', 'TechInnovation', 'ClimatePulse'). No spaces.\n\n"
                     "Return ONLY valid JSON.")
        ])

        self.debate_prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an expert debate moderator."),
            ("user", "Create a heated, 2-agent debate based on this news article.\n\n"
                     "Article Title: {article_title}\n"
                     "Article Excerpt: {article_excerpt}\n\n"
                     "Agent A Persona: {persona_a}\n"
                     "Agent B Persona: {persona_b}\n\n"
                     "Rules:\n"
                     "1. Tags MUST be one-word PascalCase (e.g., 'DebatePulse', 'TopicWar').\n\n"
                     "Output Format (JSON):\n"
                     "{{\n"
                     "  \"argument_a\": \"2-sentence argument from Agent A's perspective\",\n"
                     "  \"argument_b\": \"2-sentence counter-argument from Agent B using their unique voice\",\n"
                     "  \"debate_question\": \"A provocative question for the audience\",\n"
                     "  \"tags\": [\"TagA\", \"TagB\", \"TagC\"]\n"
                     "}}")
        ])

    async def _generate_llm_response(self, prompt: ChatPromptTemplate, values: Dict[str, Any], is_json: bool = False) -> str:
        global current_master, master_failure_count
        
        # Decide order based on current master
        providers = ['cerebras', 'groq', 'gemini']
        if current_master == 'groq':
            providers = ['groq', 'cerebras', 'gemini']
        elif current_master == 'gemini':
            providers = ['gemini', 'cerebras', 'groq']
            
        messages = prompt.format_messages(**values)
        
        last_exception = None
        
        for provider in providers:
            try:
                if provider == 'cerebras':
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
        # We can use json.JSONDecoder().raw_decode to find where the first object ends
        try:
            decoder = json.JSONDecoder()
            # Feed it the string starting from the first {
            obj, end_idx = decoder.raw_decode(content[start_idx:])
            # Now we have a valid object and the index where it ends
            
            # Special case: check if it's the "set-like" notation {"a", "b"} that decoder might have missed
            # Actually raw_decode will fail on {"a", "b"} because it's not valid JSON.
            # So let's handle the set case separately if raw_decode fails.
            
            # Re-serialize to ensures it's clean and has only what we need
            return json.dumps(obj)
        except json.JSONDecodeError:
            # If raw_decode fails, it might be the set-like notation or markdown-wrapped
            # Try to grab from first { to last } as a last resort
            match = re.search(r'(\{[\s\S]*\})', content)
            if match:
                json_str = match.group(1).strip()
                # If it's a "set" of strings like {"a", "b"}
                if '{"' in json_str and ":" not in re.sub(r'".*?"', '', json_str):
                    parts = re.findall(r'"(.*?)"', json_str)
                    if parts:
                        return json.dumps({"agent_commentary": " ".join(parts), "tags": []})
                return json_str

        return content.strip()

    def _format_tag(self, tag: str) -> str:
        """Formats a tag to PascalCase and removes non-alphanumeric chars."""
        # Split by spaces, hyphens, or underscores
        words = re.split(r'[\s\-_]+', tag)
        # Capitalize each word and join
        clean_words = [re.sub(r'\W+', '', word.capitalize()) for word in words]
        return "".join(clean_words)

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
                "agent_commentary": data.get("agent_commentary", ""),
                "tags": tags,
                "published_at": article.get("published_at")
            }
        except Exception as e:
            logger.error(f"Failed to parse reaction JSON: {e}")
            # Fallback but attempt to clean up JSON if it looks like one
            if "agent_commentary" in content:
                # Still raw JSON but we couldn't parse it? Let's just strip everything except inner double quotes
                # This is a very basic fallback. Better to actually fix the source.
                commentary_match = re.search(r'"agent_commentary":\s*"(.*?)"', content, re.DOTALL)
                commentary = commentary_match.group(1) if commentary_match else content
                return {
                    "type": "reaction",
                    "agent_id": agent["id"],
                    "article_title": article["article_title"],
                    "article_url": article["article_url"],
                    "article_excerpt": article["article_excerpt"],
                    "article_image_url": article.get("article_image_url"),
                    "source_name": article["source_name"],
                    "agent_commentary": commentary,
                    "tags": [],
                    "published_at": article.get("published_at")
                }
            
            return {
                "type": "reaction",
                "agent_id": agent["id"],
                "article_title": article["article_title"],
                "article_url": article["article_url"],
                "article_excerpt": article["article_excerpt"],
                "article_image_url": article.get("article_image_url"),
                "source_name": article["source_name"],
                "agent_commentary": content,
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
                "agent_commentary": data.get("agent_commentary", ""),
                "tags": tags,
                "published_at": article.get("published_at")
            }
        except Exception as e:
            logger.error(f"Failed to parse perspective JSON: {e}")
            if "agent_commentary" in content:
                commentary_match = re.search(r'"agent_commentary":\s*"(.*?)"', content, re.DOTALL)
                commentary = commentary_match.group(1) if commentary_match else content
                return {
                    "type": "perspective",
                    "agent_id": agent["id"],
                    "article_title": article["article_title"],
                    "article_url": article["article_url"],
                    "article_excerpt": article["article_excerpt"],
                    "article_image_url": article.get("article_image_url"),
                    "source_name": article["source_name"],
                    "agent_commentary": commentary,
                    "tags": [],
                    "published_at": article.get("published_at")
                }
            return {
                "type": "perspective",
                "agent_id": agent["id"],
                "article_title": article["article_title"],
                "article_url": article["article_url"],
                "article_excerpt": article["article_excerpt"],
                "article_image_url": article.get("article_image_url"),
                "source_name": article["source_name"],
                "agent_commentary": content,
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
                "argument_a": data["argument_a"],
                "argument_b": data["argument_b"],
                "debate_question": data["debate_question"],
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
