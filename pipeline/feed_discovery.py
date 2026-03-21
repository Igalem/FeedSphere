import feedparser
import socket
from datetime import datetime, timezone
import logging
from pipeline.db import db
from sentence_transformers import SentenceTransformer
import json
from urllib.parse import urlparse
import re
from ddgs import DDGS
import feedsearch

logger = logging.getLogger(__name__)

# Keep the model instance module-level to save memory if not called
model = None

def get_model():
    global model
    if model is None:
        model = SentenceTransformer('all-MiniLM-L6-v2')
    return model

def is_valid_rss(url: str, topic: str = None, sub_topic: str = None) -> bool:
    try:
        # Strict 5-second timeout
        socket.setdefaulttimeout(5)
        d = feedparser.parse(url)
        
        # 1. Must be valid XML/RSS
        if hasattr(d, 'bozo_exception') and isinstance(d.bozo_exception, Exception):
            logger.info(f"Invalid RSS (bozo_exception): {url}")
            return False
            
        # 2. Must have content
        if not hasattr(d, 'entries') or len(d.entries) == 0:
            logger.info(f"Invalid RSS (no entries): {url}")
            return False
            
        # 3. Freshness Check: latest entry within 30 days
        entry = d.entries[0]
        published_at = None
        if hasattr(entry, 'published_parsed') and entry.published_parsed:
            published_at = datetime(*entry.published_parsed[:6])
        elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
            published_at = datetime(*entry.updated_parsed[:6])
            
        if not published_at:
            logger.info(f"Invalid RSS (no published date): {url}")
            return False
            
        published_at = published_at.replace(tzinfo=timezone.utc)
        now_utc = datetime.now(timezone.utc)
        days_old = (now_utc.date() - published_at.date()).days
        
        if days_old > 30:
            logger.info(f"Invalid RSS (too old, {days_old} days): {url}")
            return False

        # 4. Semantic Sanity Check (New)
        if sub_topic or topic:
            feed_title = d.feed.get('title', '').lower()
            feed_desc = d.feed.get('description', '').lower()
            
            match_found = False
            
            if sub_topic:
                st_lower = sub_topic.lower()
                if st_lower.endswith('s'):
                    st_lower = st_lower[:-1]
                if st_lower in feed_title or st_lower in feed_desc:
                    match_found = True
                    
            if topic and not match_found:
                t_lower = topic.lower()
                if t_lower in feed_title or t_lower in feed_desc:
                    match_found = True
            
            if not match_found:
                logger.info(f"Feed failed semantic check for topic '{topic}' / sub_topic '{sub_topic}': {url}")
                return False
            
        return True
    except Exception as e:
        logger.error(f"Error validating RSS {url}: {e}")
        return False

def real_external_search(topic: str, sub_topic: str) -> list:
    """Uses DDG for domain discovery and feedsearch for RSS extraction."""
    query = f"{sub_topic or ''} {topic or ''} blog".strip()
    logger.info(f"DDG Search Query: {query}")
    
    urls = []
    try:
        results = DDGS().text(query, max_results=10)
        domains = [r['href'] for r in results if 'href' in r]
    except Exception as e:
        logger.error(f"DDG Error: {e}")
        return []

    for domain in domains:
        try:
            # feedsearch.search returns a list of FeedInfo objects
            feeds = feedsearch.search(domain, timeout=5)
            if feeds:
                for f in feeds:
                    if f.url:
                        urls.append(f.url)
        except Exception as e:
            logger.error(f"Feedsearch Error on {domain}: {e}")
            
    # Return unique URLs up to a reasonable limit
    return list(set(urls))

def discover_feeds_for_agent(agent_id: str, agent_persona: str, topic: str, sub_topic: str) -> list:
    logger.info(f"Starting feed discovery for agent {agent_id} (topic: {topic})")
    model = get_model()
    persona_vector = model.encode(agent_persona).tolist()
    vector_str = '[' + ','.join(map(str, persona_vector)) + ']'
    
    # Step 1: Local Vector Search (RAG)
    # 1 - (feed_embedding <=> persona_vector) gives cosine similarity
    query = """
        SELECT id, name, url, 1 - (feed_embedding <=> %s) AS similarity
        FROM rss_feeds
        WHERE feed_embedding IS NOT NULL
        AND 1 - (feed_embedding <=> %s) > 0.80
    """
    params = [vector_str, vector_str]
    
    if topic:
        query += " AND topic = %s"
        params.append(topic)
        
    query += " ORDER BY similarity DESC LIMIT 4"
    
    results = db.fetch_all(query, tuple(params))
    
    valid_feeds = []
    
    # Step 2: Evaluate Results
    if results and len(results) >= 2:
        logger.info(f"RAG Success: Found {len(results)} relevant local feeds.")
        valid_feeds = [{"name": r["name"], "url": r["url"]} for r in results]
    else:
        logger.info(f"RAG Fallback triggered: Only {len(results) if results else 0} local feeds found. Initiating JIT discovery.")
        if results:
            valid_feeds = [{"name": r["name"], "url": r["url"]} for r in results]
            
        # Step 3: Just-In-Time Discovery
        candidates = real_external_search(topic, sub_topic)
        final_new_feeds = []
        for url in candidates:
            if len(valid_feeds) + len(final_new_feeds) >= 4:
                break
            if is_valid_rss(url, topic, sub_topic):
                try:
                    d = feedparser.parse(url)
                    name = getattr(d.feed, 'title', url)
                    # clean typical feed titles
                    name = re.sub(r'(?i)\.net|\.com|\.org|\.io', '', name)
                    name = re.sub(r'(?i)Latest Articles Feed|RSS Feed|Feed|Articles|News| - .*', '', name).strip()
                except:
                    name = url
                    
                # check if not already in valid_feeds
                if not any(vf['url'] == url for vf in valid_feeds):
                    final_new_feeds.append({"name": name, "url": url})
                
        # Step 4: The Flywheel (Save to DB)
        for feed in final_new_feeds:
            exists = db.fetch_one("SELECT id FROM rss_feeds WHERE url = %s", (feed['url'],))
            if not exists:
                feed_text = f"{feed['name']} - {topic} {sub_topic or ''}"
                feed_emb = model.encode(feed_text).tolist()
                feed_emb_str = '[' + ','.join(map(str, feed_emb)) + ']'
                
                domain = urlparse(feed['url']).netloc
                
                try:
                    db.execute("""
                        INSERT INTO rss_feeds (name, url, topic, category, domain, feed_embedding)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        ON CONFLICT (url) DO NOTHING
                    """, (feed['name'], feed['url'], topic, sub_topic, domain, feed_emb_str))
                    logger.info(f"Flywheel inserted new feed: {feed['url']}")
                except Exception as e:
                    logger.error(f"Error inserting new feed {feed['url']}: {e}")

        # Combine old valid feeds with final new feeds
        valid_feeds.extend(final_new_feeds)

    # Step 5: Attach to Agent
    if not valid_feeds:
        logger.warning(f"No valid feeds found at all for agent {agent_id}.")
        return []
        
    # Strictly formatting to: [{"name": "Feed Name", "url": "https://..."}]
    feeds_json = json.dumps(valid_feeds)
    try:
        db.execute("UPDATE agents SET rss_feeds = %s WHERE id = %s", (feeds_json, agent_id))
        logger.info(f"Successfully attached {len(valid_feeds)} feeds to agent {agent_id}.")
    except Exception as e:
        logger.error(f"Error attaching feeds to agent {agent_id}: {e}")
        
    return valid_feeds
