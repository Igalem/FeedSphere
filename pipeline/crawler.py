import feedparser
import json
import logging
import socket
import requests
import re
import html
from concurrent.futures import ThreadPoolExecutor
from bs4 import BeautifulSoup
from .db import db
from .config import settings
from datetime import datetime, timezone

# Set global socket timeout to prevent hang on slow feeds
socket.setdefaulttimeout(10)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class Crawler:
    def __init__(self):
        pass

    def clean_source_name(self, name):
        # Remove suffixes like "Latest Articles Feed", "RSS Feed", etc.
        name = re.sub(r'(?i)\.net|\.com|\.org|\.io', '', name)
        name = re.sub(r'(?i)Latest Articles Feed|RSS Feed|Feed|Articles|News| - .*', '', name)
        return name.strip()

    def get_feeds(self):
        # Fetch feeds from rss_feeds table
        feeds = db.fetch_all("SELECT name, url, topic, category, language, country FROM rss_feeds")
        return feeds

    def is_duplicate(self, url):
        # Check in news_articles first
        exists = db.fetch_one("SELECT id FROM news_articles WHERE url = %s", (url,))
        if exists:
            return True
        # Check in posts table
        post_exists = db.fetch_one("SELECT id FROM posts WHERE article_url = %s", (url,))
        if post_exists:
            return True
        # Check in debates table
        debate_exists = db.fetch_one("SELECT id FROM debates WHERE article_url = %s", (url,))
        if debate_exists:
            return True
        return False

    def fetch_feed(self, feed_url, feed_name=None, feed_topic=None, feed_sub_topic=None, feed_language=None, feed_country=None):
        logger.info(f"Fetching feed: {feed_url}")
        try:
            # Use a short timeout for the specific request
            d = feedparser.parse(feed_url)
        except Exception as e:
            logger.error(f"Error fetching feed {feed_url}: {e}")
            return []

        new_articles = []
        if not hasattr(d, 'entries'):
            return []

        for entry in d.entries:
            url = entry.get("link")
            if not url or self.is_duplicate(url):
                continue

            # Extract published date for filtering
            published_at = None
            if hasattr(entry, 'published_parsed') and entry.published_parsed:
                published_at = datetime(*entry.published_parsed[:6])
            elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
                published_at = datetime(*entry.updated_parsed[:6])
            
            # Skip articles that are too old based on CRAWLER_DELTA_DAYS
            if published_at:
                # Force UTC awareness on parsed date
                published_at = published_at.replace(tzinfo=timezone.utc)
                now_utc = datetime.now(timezone.utc)
                
                # Use a small buffer if delta_days is 0 to catch articles from late yesterday
                # or just use simple days comparison on aware datetimes
                days_old = (now_utc.date() - published_at.date()).days
                
                if days_old > settings.CRAWLER_DELTA_DAYS:
                    logger.info(f"Skipping article '{entry.get('title', 'No Title')}' from {published_at.date()} ({days_old} days old, > {settings.CRAWLER_DELTA_DAYS} delta)")
                    continue
            else:
                # If no date found, skip to ensure we handle things correctly
                logger.warning(f"Skipping article '{entry.get('title', 'No Title')}' - no published date found.")
                continue

            title = html.unescape(entry.get("title", "No Title"))
            summary = entry.get("summary", entry.get("description", ""))
            
            soup = BeautifulSoup(summary, "html.parser")
            clean_summary = html.unescape(soup.get_text())

            # Now we use the feed's topic/sub_topic directly
            topic = feed_topic
            sub_topic = feed_sub_topic

            if not topic:
                logger.warning(f"Skipping article '{title}' - no topic provided for feed.")
                continue

            # 1. NEW: Identify Video URL first (specifically YouTube)
            video_url = None
            if 'media_content' in entry and entry.media_content:
                for mc in entry.media_content:
                    v_url = mc.get('url', '')
                    if "youtube.com" in v_url or "vimeo.com" in v_url or v_url.endswith(('.mp4', '.mov')):
                        video_url = v_url
                        break
            
            if not video_url:
                # Check for YouTube links in the entry or content
                for link in entry.get('links', []):
                    l_href = link.get('href', '')
                    if "youtube.com/embed/" in l_href:
                        video_url = l_href
                        break

            # 2. Extract best possible Image (Prioritizing static images/thumbnails)
            image_url = None
            
            # --- PRIORITY 1: media_thumbnail within media_content ---
            if 'media_content' in entry and entry.media_content:
                for mc in entry.media_content:
                    if 'thumbnails' in mc and mc.thumbnails:
                        image_url = mc.thumbnails[0].get('url')
                        if image_url: break

            # --- PRIORITY 2: Standalone media_thumbnail ---
            if not image_url and 'media_thumbnail' in entry and entry.media_thumbnail:
                image_url = entry.media_thumbnail[0].get('url')
            
            # --- PRIORITY 3: Actual image in enclosures ---
            if not image_url:
                for enclosure in entry.get('enclosures', []):
                    e_type = enclosure.get('type', '')
                    if e_type.startswith('image'):
                        image_url = enclosure.get('href')
                        break
            
            # --- PRIORITY 4: Specific image types in media_content ---
            if not image_url and 'media_content' in entry:
                for mc in entry.media_content:
                    m_url = mc.get('url', '')
                    m_type = mc.get('type', '')
                    if m_type.startswith('image') or m_url.lower().endswith(('.jpg', '.jpeg', '.png', '.webp', '.gif')):
                        image_url = m_url
                        break

            # --- PRIORITY 5: Scrape OG Image ---
            if not image_url:
                try:
                    page_res = requests.get(url, timeout=5, headers={'User-Agent': 'Mozilla/5.0'})
                    if page_res.status_code == 200:
                        page_soup = BeautifulSoup(page_res.text, "html.parser")
                        og_image = page_soup.find("meta", property="og:image")
                        if og_image:
                            image_url = og_image.get("content")
                except Exception:
                    pass

            # 3. Fallback/Transformation Logic
            # If we have a video but NO image, use the video thumbnail as the image
            if not image_url and video_url and "youtube.com/embed/" in video_url:
                video_id = video_url.split("youtube.com/embed/")[1].split("?")[0].split("/")[0]
                image_url = f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"
                logger.info(f"Using YouTube thumbnail as fallback image: {image_url}")

            # Final check: Don't let video URLs leak into image_url field unless they are thumbnails
            if image_url and any(ext in image_url.lower() for ext in ["youtube.com/embed/", "player.vimeo.com", ".mp4", ".mov"]):
                if "youtube.com/embed/" in image_url:
                    video_id = image_url.split("youtube.com/embed/")[1].split("?")[0].split("/")[0]
                    # Attempt to extract video URL if not already found
                    if not video_url: video_url = image_url
                    image_url = f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"
                else:
                    image_url = None # Let fallback logic handle it

            if not image_url:
                # Fallback to topic-based images with variety
                topic_lower = (topic or "news").lower()
                
                # Multiple image options per topic for variety
                placeholder_pools = {
                    "sports": [
                        "https://images.unsplash.com/photo-1461896756913-c27eeff1d9b1?q=80&w=1000",
                        "https://images.unsplash.com/photo-1504450758481-7338eba7524a?q=80&w=1000",
                        "https://images.unsplash.com/photo-1471295253337-3ceaaedca401?q=80&w=1000",
                        "https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=1000"
                    ],
                    "tech": [
                        "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?q=80&w=1000",
                        "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1000",
                        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1000",
                        "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1000"
                    ],
                    "gaming": [
                        "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1000",
                        "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=1000",
                        "https://images.unsplash.com/photo-1552824236-0776484ffb27?q=80&w=1000",
                        "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1000"
                    ],
                    "news": [
                        "https://images.unsplash.com/photo-1495020689067-958852a7765e?q=80&w=1000",
                        "https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=1000",
                        "https://images.unsplash.com/photo-1476242484419-cf5c5d4462bc?q=80&w=1000",
                        "https://images.unsplash.com/photo-1588681664899-f142ff2dc9b1?q=80&w=1000"
                    ],
                    "entertainment": [
                        "https://images.unsplash.com/photo-1603190287605-e6ade32fa852?q=80&w=1000",
                        "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1000",
                        "https://images.unsplash.com/photo-1514525253344-99a4299965d2?q=80&w=1000",
                        "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1000"
                    ],
                    "health": [
                        "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?q=80&w=1000",
                        "https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?q=80&w=1000",
                        "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=1000",
                        "https://images.unsplash.com/photo-1498837167922-ddd27525d352?q=80&w=1000"
                    ]
                }
                
                # Pick a pool or default to news
                pool = placeholder_pools.get(topic_lower, placeholder_pools["news"])
                
                # Deterministically pick an image from the pool based on article URL
                import hashlib
                url_hash = int(hashlib.md5(url.encode()).hexdigest(), 16)
                image_url = pool[url_hash % len(pool)]
                
                logger.info(f"Using varied fallback image for topic '{topic_lower}': {image_url}")

            if image_url:
                logger.info(f"Final image for article '{title}': {image_url}")
            else:
                logger.warning(f"No image found for article '{title}' even with fallback!")

            article = {
                "article_title": title,
                "article_url": url,
                "article_excerpt": clean_summary[:500],
                "article_image_url": image_url,
                "video_url": video_url,
                "topic": topic,
                "sub_topic": sub_topic,
                "source_name": feed_name or self.clean_source_name(getattr(d.feed, 'title', feed_url)),
                "published_at": published_at,
                "language": feed_language,
                "country": feed_country
            }
            
            # Save incrementally for better tracking
            try:
                db.execute("""
                    INSERT INTO news_articles (title, url, excerpt, image_url, video_url, source_name, topic, sub_topic, published_at, language, country)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (url) DO NOTHING
                """, (
                    article["article_title"],
                    article["article_url"],
                    article["article_excerpt"],
                    article["article_image_url"],
                    article.get("video_url"),
                    article["source_name"],
                    article["topic"],
                    article["sub_topic"],
                    article["published_at"],
                    article.get("language"),
                    article.get("country")
                ))
            except Exception as e:
                logger.error(f"Error saving article to news_articles: {e}")

            new_articles.append(article)
        
        return new_articles

    def run(self, limit_feeds=None):
        logger.info("Starting crawl...")
        all_new_articles = []
        feeds = self.get_feeds()
        logger.info(f"Found {len(feeds)} feeds to process")

        if limit_feeds:
            feeds = feeds[:limit_feeds]
            logger.info(f"Limiting to first {limit_feeds} feeds")

        # Process feeds concurrently using ThreadPoolExecutor
        # limit to 10 threads to avoid overwhelming sources
        with ThreadPoolExecutor(max_workers=10) as executor:
            future_to_feed = {executor.submit(self.fetch_feed, f["url"], f.get("name"), f.get("topic"), f.get("category"), f.get("language"), f.get("country")): f for f in feeds}
            for future in future_to_feed:
                try:
                    articles = future.result()
                    all_new_articles.extend(articles)
                except Exception as e:
                    logger.error(f"Feed processing failed: {e}")
        
        logger.info(f"Crawl completed. Found {len(all_new_articles)} new articles.")
        return all_new_articles

if __name__ == "__main__":
    crawler = Crawler()
    # To run all feeds, remove limit_feeds
    articles = crawler.run()
    print(f"Crawl completed. Found {len(articles)} new articles.")
