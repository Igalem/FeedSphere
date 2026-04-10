import feedparser
import socket
from datetime import datetime, timezone
import logging
from .db import db
from .utils import EmbeddingModel
from .config import settings
import json
from urllib.parse import urlparse
import re
from ddgs import DDGS
import feedsearch
import requests
from bs4 import BeautifulSoup
import numpy as np

logger = logging.getLogger(__name__)

def get_model():
    return EmbeddingModel.get_model()

def cosine_similarity(v1, v2):
    """Calculates cosine similarity between two vector strings or arrays."""
    if isinstance(v1, str):
        v1 = np.array(json.loads(v1))
    if isinstance(v2, str):
        v2 = np.array(json.loads(v2))
    
    dot_product = np.dot(v1, v2)
    norm_v1 = np.linalg.norm(v1)
    norm_v2 = np.linalg.norm(v2)
    return dot_product / (norm_v1 * norm_v2)

def is_valid_rss(url: str, topic: str = None, sub_topic: str = None, persona_vector: str = None) -> bool:
    try:
        if "youtube.com" in url.lower():
            logger.info(f"Invalid RSS (Skipping youtube for now): {url}")
            return False

        socket.setdefaulttimeout(5)
        d = feedparser.parse(url)
        
        if hasattr(d, 'bozo_exception') and isinstance(d.bozo_exception, Exception):
            logger.info(f"Invalid RSS (bozo_exception): {url}")
            return False
            
        if not hasattr(d, 'entries') or len(d.entries) == 0:
            logger.info(f"Invalid RSS (no entries): {url}")
            return False
            
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
        
        if days_old > settings.RSS_FEED_DELTA_DAYS:
            logger.info(f"Invalid RSS (too old, {days_old} days): {url}")
            return False

        # --- Option C: Hybrid Semantic Sanity Check ---
        if sub_topic or topic:
            feed_title = d.feed.get('title', '').lower()
            feed_desc = d.feed.get('description', '').lower()
            
            match_found = False
            
            # 1. Exact Phrase Check (High Priority)
            if sub_topic and (sub_topic.lower() in feed_title or sub_topic.lower() in feed_desc):
                match_found = True
            elif topic and (topic.lower() in feed_title or topic.lower() in feed_desc):
                match_found = True

            # 2. Vector Fallback (Smart Check)
            if not match_found and persona_vector:
                # Combined feed text to represent the "essence" of the feed
                feed_essence = f"{d.feed.get('title', '')} {d.feed.get('description', '')}".strip()
                if feed_essence:
                    feed_vector_str = EmbeddingModel.encode(feed_essence)
                    similarity = cosine_similarity(persona_vector, feed_vector_str)
                    
                    if similarity >= 0.75:
                        logger.info(f"Feed passed Vector Fallback (sim: {similarity:.2f}): {url}")
                        match_found = True
                    else:
                        logger.info(f"Feed failed Vector Fallback (sim: {similarity:.2f}): {url}")

            if not match_found:
                logger.info(f"Feed failed hybrid sanity check for topic '{topic}' / sub_topic '{sub_topic}': {url}")
                return False
            
        return True
    except Exception as e:
        logger.error(f"Error validating RSS {url}: {e}")
        return False

def real_external_search(topic: str, sub_topic: str) -> list:
    urls = []
    search_keyword = sub_topic or topic or ""
    if search_keyword:
        import urllib.parse
        path_kw = search_keyword.replace(" ", "_").lower()
        keyword_encoded = urllib.parse.quote(search_keyword.lower())
        feedspot_url = f"https://rss.feedspot.com/{path_kw}_rss_feeds/?_src=search&keyword={keyword_encoded}"
        try:
            headers = {'User-Agent': 'Mozilla/5.0'}
            html = requests.get(feedspot_url, headers=headers, timeout=5).text
            soup = BeautifulSoup(html, 'html.parser')
            links = soup.find_all('a', href=True)
            for link in links:
                href = link['href']
                if href.startswith('http') and 'feedspot.com' not in href:
                    if 'feed' in href.lower() or 'rss' in href.lower() or 'xml' in href.lower():
                        urls.append(href)
            if urls:
                logger.info(f"Found {len(urls)} RSS URLs via Feedspot for {search_keyword}")
        except Exception as e:
            logger.error(f"Feedspot extraction error: {e}")

    if len(urls) < 5:
        query = f"{sub_topic or ''} {topic or ''} blog".strip()
        logger.info(f"DDG Search Query: {query}")
        try:
            results = DDGS().text(query, max_results=10)
            domains = [r['href'] for r in results if 'href' in r]
        except Exception as e:
            logger.error(f"DDG Error: {e}")
            domains = []

        for domain in domains:
            try:
                feeds = feedsearch.search(domain, timeout=5)
                if feeds:
                    for f in feeds:
                        if f.url:
                            urls.append(f.url)
            except Exception as e:
                logger.error(f"Feedsearch Error on {domain}: {e}")
                
    return list(set(urls))

def discover_candidate_feeds(search_topic: str, search_sub_topic: str, persona_vector: str, limit: int) -> list:
    query = """
        SELECT name, url, 1 - (feed_embedding <=> %s) AS similarity
        FROM rss_feeds
        WHERE feed_embedding IS NOT NULL
        AND 1 - (feed_embedding <=> %s) > 0.80
    """
    params = [persona_vector, persona_vector]
    if search_topic:
        query += " AND (topic = %s OR category = %s)"
        params.extend([search_topic, search_topic])
    query += " ORDER BY similarity DESC LIMIT %s"
    params.append(limit)

    results = db.fetch_all(query, tuple(params))
    valid_feeds = [{"name": r["name"], "url": r["url"]} for r in results]

    if len(valid_feeds) < limit:
        candidates = real_external_search(search_topic, search_sub_topic)
        for url in candidates:
            if len(valid_feeds) >= limit:
                break
            # Pass persona_vector into is_valid_rss for hybrid validation
            if not any(vf['url'] == url for vf in valid_feeds) and is_valid_rss(url, search_topic, search_sub_topic, persona_vector):
                try:
                    d = feedparser.parse(url)
                    name = getattr(d.feed, 'title', url)
                    name = re.sub(r'(?i)\.net|\.com|\.org|\.io', '', name)
                    name = re.sub(r'(?i)Latest Articles Feed|RSS Feed|Feed|Articles|News| - .*', '', name).strip()
                except:
                    name = url
                
                valid_feeds.append({"name": name, "url": url})
                
                if not db.fetch_one("SELECT id FROM rss_feeds WHERE url = %s", (url,)):
                    feed_text = f"{name} - {search_topic} {search_sub_topic or ''}"
                    feed_emb_str = EmbeddingModel.encode(feed_text)
                    domain = urlparse(url).netloc
                    try:
                        db.execute("""
                            INSERT INTO rss_feeds (name, url, topic, category, domain, feed_embedding)
                            VALUES (%s, %s, %s, %s, %s, %s)
                            ON CONFLICT (url) DO NOTHING
                        """, (name, url, search_topic, search_sub_topic, domain, feed_emb_str))
                    except Exception as e:
                        logger.error(f"Flywheel error: {e}")

    return valid_feeds

def discover_feeds_for_agent(agent_id: str, agent_persona: str, topic: str, sub_topic: str) -> list:
    logger.info(f"Starting hybrid weighted feed discovery for agent {agent_id} (topic: {topic}, sub_topic: {sub_topic})")
    vector_str = EmbeddingModel.encode(agent_persona)
    
    max_total = 10
    sub_topic_limit = round(max_total * settings.SUB_TOPIC_WEIGHT)
    topic_limit = max_total - sub_topic_limit

    sub_topic_feeds = discover_candidate_feeds(sub_topic, None, vector_str, sub_topic_limit)
    topic_feeds = discover_candidate_feeds(topic, None, vector_str, topic_limit)

    all_feeds = []
    seen_urls = set()
    for f in sub_topic_feeds + topic_feeds:
        if f['url'] not in seen_urls:
            all_feeds.append(f)
            seen_urls.add(f['url'])
            if len(all_feeds) >= max_total:
                break

    if not all_feeds:
        logger.warning(f"No valid feeds found for agent {agent_id}.")
        return []

    feeds_json = json.dumps(all_feeds)
    try:
        db.execute("UPDATE agents SET rss_feeds = %s WHERE id = %s", (feeds_json, agent_id))
        logger.info(f"Successfully attached {len(all_feeds)} hybrid weighted feeds to agent {agent_id}.")
    except Exception as e:
        logger.error(f"Error attaching feeds: {e}")
        
    return all_feeds
