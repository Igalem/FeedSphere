import feedparser
import json
import logging
import socket
import requests
import re
from concurrent.futures import ThreadPoolExecutor
from bs4 import BeautifulSoup
from pipeline.db import db
from pipeline.config import settings
from datetime import datetime

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
        feeds = db.fetch_all("SELECT name, url, topic, category FROM rss_feeds")
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

    def fetch_feed(self, feed_url, feed_name=None, feed_topic=None, feed_sub_topic=None):
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
                days_old = (datetime.now().date() - published_at.date()).days
                if days_old > settings.CRAWLER_DELTA_DAYS:
                    logger.info(f"Skipping article '{entry.get('title', 'No Title')}' from {published_at.date()} ({days_old} days old, > {settings.CRAWLER_DELTA_DAYS} delta)")
                    continue
            else:
                # If no date found, skip to ensure we handle things correctly
                logger.warning(f"Skipping article '{entry.get('title', 'No Title')}' - no published date found.")
                continue

            title = entry.get("title", "No Title")
            summary = entry.get("summary", entry.get("description", ""))
            
            soup = BeautifulSoup(summary, "html.parser")
            clean_summary = soup.get_text()

            # Now we use the feed's topic/sub_topic directly
            topic = feed_topic
            sub_topic = feed_sub_topic

            if not topic:
                logger.warning(f"Skipping article '{title}' - no topic provided for feed.")
                continue

            # Try to find an image
            image_url = None
            if 'media_content' in entry and entry.media_content:
                image_url = entry.media_content[0].get('url')
            
            if not image_url and 'links' in entry:
                for link in entry.links:
                    if link.get('rel') == 'enclosure' and link.get('type', '').startswith('image'):
                        image_url = link.get('href')
                        break
            
            if not image_url and 'media_thumbnail' in entry and entry.media_thumbnail:
                image_url = entry.media_thumbnail[0].get('url')

            if not image_url:
                # Check enclosures directly
                for enclosure in entry.get('enclosures', []):
                    if enclosure.get('type', '').startswith('image'):
                        image_url = enclosure.get('href')
                        break

            if not image_url:
                # Look for img tag in summary/content
                img_tag = soup.find('img')
                if img_tag:
                    image_url = img_tag.get('src')
                elif 'content' in entry:
                    # Also check full content if available
                    for c in entry.content:
                        content_soup = BeautifulSoup(c.value, "html.parser")
                        img_tag = content_soup.find('img')
                        if img_tag:
                            image_url = img_tag.get('src')
                            break

            if not image_url:
                # If still no image, try to fetch the article page for og:image
                try:
                    page_res = requests.get(url, timeout=5, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
                    if page_res.status_code == 200:
                        page_soup = BeautifulSoup(page_res.text, "html.parser")
                        og_image = page_soup.find("meta", property="og:image")
                        if og_image:
                            image_url = og_image.get("content")
                except Exception as e:
                    logger.debug(f"Failed to scrape og:image for {url}: {e}")

            if not image_url:
                # Fallback to topic-based images
                topic_lower = (topic or "news").lower()
                placeholders = {
                    "sports": "https://images.unsplash.com/photo-1461896756913-c27eeff1d9b1?q=80&w=1000",
                    "tech": "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?q=80&w=1000",
                    "gaming": "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1000",
                    "news": "https://images.unsplash.com/photo-1495020689067-958852a7765e?q=80&w=1000",
                    "entertainment": "https://images.unsplash.com/photo-1603190287605-e6ade32fa852?q=80&w=1000",
                    "health": "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?q=80&w=1000"
                }
                image_url = placeholders.get(topic_lower, placeholders["news"])
                logger.info(f"Using fallback image for topic '{topic_lower}': {image_url}")

            if image_url:
                logger.info(f"Final image for article '{title}': {image_url}")
            else:
                logger.warning(f"No image found for article '{title}' even with fallback!")

            article = {
                "article_title": title,
                "article_url": url,
                "article_excerpt": clean_summary[:500],
                "article_image_url": image_url,
                "topic": topic,
                "sub_topic": sub_topic,
                "source_name": feed_name or self.clean_source_name(getattr(d.feed, 'title', feed_url)),
                "published_at": published_at
            }
            
            # Save incrementally for better tracking
            try:
                db.execute("""
                    INSERT INTO news_articles (title, url, excerpt, image_url, source_name, topic, sub_topic, published_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (url) DO NOTHING
                """, (
                    article["article_title"],
                    article["article_url"],
                    article["article_excerpt"],
                    article["article_image_url"],
                    article["source_name"],
                    article["topic"],
                    article["sub_topic"],
                    article["published_at"]
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
            future_to_feed = {executor.submit(self.fetch_feed, f["url"], f.get("name"), f.get("topic"), f.get("category")): f for f in feeds}
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
