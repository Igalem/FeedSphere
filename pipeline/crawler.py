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
from .utils import sanitize_topic
from datetime import datetime, timezone
import base64
import urllib.parse
from langdetect import detect

# Set global socket timeout to prevent hang on slow feeds
socket.setdefaulttimeout(10)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Upgrade-Insecure-Requests': '1'
}

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
        feeds = db.fetch_all("SELECT name, url, topic, language, country FROM rss_feeds")
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

    def fetch_feed(self, feed_url, feed_name=None, feed_topic=None, feed_language=None, feed_country=None):
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

        # Pre-check: If the newest article in the feed is older than 1 year, delete the feed
        if d.entries:
            max_pub = None
            for entry in d.entries:
                entry_pub = None
                # Check multiple potential date fields
                date_fields = ['published_parsed', 'updated_parsed', 'created_parsed']
                for field in date_fields:
                    if hasattr(entry, field) and getattr(entry, field):
                        entry_pub = datetime(*getattr(entry, field)[:6])
                        break
                
                if not entry_pub and 'published' in entry:
                    try:
                        from dateutil import parser as date_parser
                        entry_pub = date_parser.parse(entry.published)
                    except:
                        pass

                if entry_pub:
                    if not entry_pub.tzinfo:
                        entry_pub = entry_pub.replace(tzinfo=timezone.utc)
                    if max_pub is None or entry_pub > max_pub:
                        max_pub = entry_pub
            
            if max_pub:
                days_since_latest = (datetime.now(timezone.utc) - max_pub).days
                if days_since_latest > 365:
                    logger.warning(f"Feed {feed_url} is dead (latest article from {max_pub.date()}, {days_since_latest} days ago). Deleting from DB and updating seed SQL.")
                    db.execute("DELETE FROM rss_feeds WHERE url = %s", (feed_url,))
                    # Trigger seed update script
                    try:
                        import subprocess
                        # Ensure we use the full path to node if needed, or just node
                        subprocess.run(["node", "feedsphere/scripts/dump_seed_feeds.js"], 
                                       env={"DATABASE_URL": settings.DATABASE_URL}, 
                                       cwd=".", capture_output=True)
                    except Exception as e:
                        logger.error(f"Failed to update seed SQL: {e}")
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
            
            # Skip articles that are too old based on CRAWLER_DELTA_DAYS or from the future
            if published_at:
                # Force UTC awareness on parsed date
                published_at = published_at.replace(tzinfo=timezone.utc)
                now_utc = datetime.now(timezone.utc)
                
                # Filter out articles from the future to prevent data issues
                if published_at > now_utc:
                    logger.info(f"Skipping article '{entry.get('title', 'No Title')}' - published date {published_at} is in the future (current time: {now_utc})")
                    continue

                # Use a small buffer if delta_days is 0 to catch articles from late yesterday
                # or just use simple days comparison on aware datetimes
                days_old = (now_utc.date() - published_at.date()).days
                
                if days_old > settings.CRAWLER_DELTA_DAYS:
                    if days_old > 365:
                        logger.debug(f"Skipping very old article '{entry.get('title', 'No Title')}' from {published_at.date()}")
                    else:
                        logger.info(f"Skipping article '{entry.get('title', 'No Title')}' from {published_at.date()} ({days_old} days old, > {settings.CRAWLER_DELTA_DAYS} delta)")
                    continue
            else:
                # If no date found, skip to ensure we handle things correctly
                logger.debug(f"Skipping article '{entry.get('title', 'No Title')}' - no published date found.")
                continue

            title = html.unescape(entry.get("title", "No Title"))
            summary = entry.get("summary", entry.get("description", ""))
            
            soup = BeautifulSoup(summary, "html.parser")
            clean_summary = html.unescape(soup.get_text())

            # Now we use the feed's topic sanitized
            topic = sanitize_topic(feed_topic)

            if not topic:
                logger.warning(f"Skipping article '{title}' - no topic provided for feed.")
                continue

            # 1. NEW: Identify Video URL first (specifically YouTube)
            video_url = None
            if 'media_content' in entry and entry.media_content:
                for mc in entry.media_content:
                    v_url = mc.get('url', '')
                    if any(v in v_url.lower() for v in ["youtube.com", "youtu.be", "vimeo.com", "dailymotion.com", "yahoo.com/video"]) or v_url.lower().endswith(('.mp4', '.mov', '.m3u8')):
                        video_url = v_url
                        break
            
            if not video_url:
                # Check for video links in the entry or content
                for link in entry.get('links', []):
                    l_href = link.get('href', '')
                    if any(v in l_href.lower() for v in ["youtube.com", "youtu.be", "vimeo.com", "dailymotion.com", "yahoo.com/video"]):
                        video_url = l_href
                        break

            # Helper to convert youtube to embed
            def to_embed(url):
                if not url: return None
                if "youtube.com/shorts/" in url:
                    return url.replace("youtube.com/shorts/", "youtube.com/embed/").split('?')[0]
                if "youtube.com/watch?v=" in url:
                    return url.replace("youtube.com/watch?v=", "youtube.com/embed/").split('&')[0]
                if "youtu.be/" in url:
                    return url.replace("youtu.be/", "youtube.com/embed/").split('?')[0]
                return url

            video_url = to_embed(video_url)

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
            
            # --- PRIORITY 4.5: Find image tags in summary/description ---
            if not image_url and summary:
                s_soup = BeautifulSoup(summary, "html.parser")
                img_tag = s_soup.find("img")
                if img_tag:
                    image_url = img_tag.get("src") or img_tag.get("data-src")
                    if image_url:
                        logger.info(f"Found image in RSS summary: {image_url}")

            scraped_excerpt = None
            if not image_url or not video_url or len(clean_summary) < 200:
                try:
                    # Special handling for Google News redirects
                    target_url = url
                    if "news.google.com" in url:
                        try:
                            # Try to follow redirect with a session to get the real URL
                            with requests.Session() as s:
                                s.headers.update(BROWSER_HEADERS)
                                r = s.get(url, timeout=5, allow_redirects=True)
                                if r.url != url:
                                    target_url = r.url
                                    # logger.info(f"Followed Google News redirect to: {target_url}")
                        except:
                            pass

                    # Use BROWSER_HEADERS to avoid 403s
                    page_res = requests.get(target_url, timeout=10, headers=BROWSER_HEADERS)
                    
                    # If 403, try a different approach (simpler headers)
                    if page_res.status_code == 403:
                        simple_headers = {'User-Agent': 'Mozilla/5.0'}
                        page_res = requests.get(target_url, timeout=10, headers=simple_headers)

                    if page_res.status_code == 200:
                        page_soup = BeautifulSoup(page_res.text, "html.parser")
                        
                        # 5a. Robust Image Extraction
                        if not image_url:
                            # Try various meta images for maximum robustness
                            meta_candidates = [
                                ("meta", {"property": "og:image"}),
                                ("meta", {"name": "twitter:image"}),
                                ("meta", {"property": "twitter:image"}),
                                ("meta", {"name": "thumbnail"}),
                                ("link", {"rel": "image_src"}),
                                ("meta", {"itemprop": "image"}),
                                ("link", {"rel": "preload", "as": "image"}),
                                ("meta", {"name": "sailthru.image"}),
                                ("meta", {"name": "sailthru.image.full"}),
                                ("meta", {"name": "sailthru.image.thumb"})
                            ]
                            for tag_type, attrs in meta_candidates:
                                tag = page_soup.find(tag_type, attrs=attrs)
                                if tag:
                                    candidate = tag.get("content") or tag.get("href")
                                    # Relax 'logo' rejection but still avoid ads/tiny svgs/icons
                                    if candidate and not any(v in candidate.lower() for v in ["doubleclick.net", "ads.", ".svg", "icon"]): 
                                        image_url = candidate
                                        break
                            
                            # Last ditch: Find largest image in article
                            if not image_url:
                                images = page_soup.find_all("img", src=True)
                                if images:
                                    # Prioritize high-res JPG/PNG and not common ad format
                                    # Avoid images with 'logo' in them unless they are large (heuristic)
                                    candidates = [i for i in images if (".jpg" in i["src"].lower() or ".png" in i["src"].lower()) and "logo" not in i["src"].lower()]
                                    if candidates:
                                        image_url = candidates[0]["src"]

                        # 5b. Robust Excerpt Extraction (if RSS summary is poor)
                        if len(clean_summary) < 200:
                            og_desc = page_soup.find("meta", property="og:description")
                            if og_desc:
                                scraped_excerpt = og_desc.get("content")
                            
                            if not scraped_excerpt:
                                tw_desc = page_soup.find("meta", attrs={"name": "twitter:description"})
                                if tw_desc:
                                    scraped_excerpt = tw_desc.get("content")
                            if not scraped_excerpt:
                                # Look for typical article content blocks
                                for selector in ['article', '.article-content', '.post-content', '.entry-content', '.content']:
                                    block = page_soup.select_one(selector)
                                    if block:
                                        paragraphs = block.find_all('p')
                                        text = " ".join([p.get_text(strip=True) for p in paragraphs if len(p.get_text()) > 30])
                                        if len(text) > 100:
                                            scraped_excerpt = text
                                            break
                        
                        # 5c. Robust Video Extraction
                        if not video_url:
                            # 1. Try Meta Tags first (Highest quality/intent)
                            meta_video_candidates = [
                                ("meta", {"property": "og:video"}),
                                ("meta", {"property": "og:video:secure_url"}),
                                ("meta", {"name": "twitter:player"}),
                                ("meta", {"property": "twitter:player"})
                            ]
                            for tag_type, attrs in meta_video_candidates:
                                tag = page_soup.find(tag_type, attrs=attrs)
                                if tag:
                                    v_cand = tag.get("content") or tag.get("href")
                                    if v_cand:
                                        video_url = to_embed(v_cand)
                                        if video_url: break

                        if not video_url:
                            # 2. Search for iframes in likely content areas
                            content_selectors = ['article', '.article-content', '.post-content', '.entry-content', '.content', '#main-content']
                            for selector in content_selectors:
                                area = page_soup.select_one(selector)
                                if area:
                                    # Look for youtube iframes
                                    iframes = area.find_all("iframe", src=True)
                                    for iframe in iframes:
                                        src = iframe["src"]
                                        if any(v in src.lower() for v in ["youtube.com", "youtu.be", "vimeo.com", "dailymotion.com", "yahoo.com/video"]):
                                            video_url = to_embed(src)
                                            if video_url: break
                                    if video_url: break

                        if not video_url:
                            # 3. Last Resort: Global Page search but ONLY for embed patterns
                            yt_match = re.search(r'youtube\.com/embed/([a-zA-Z0-9_-]{11})', page_res.text)
                            if yt_match:
                                video_id = yt_match.group(1)
                                video_url = f"https://www.youtube.com/embed/{video_id}"
                                # logger.info(f"Scraped YouTube embed from page text: {video_id}")
                            
                            # Removed aggressive Yahoo global page search for video IDs as it often picks up unrelated sidebars.
                            # We now rely on meta tags and content-area iframes above.
                            pass
                except Exception as e:
                    logger.debug(f"Scraping failed for {url}: {e}")
                    pass

            # Combine summaries if needed
            final_excerpt = clean_summary
            if scraped_excerpt and len(scraped_excerpt) > len(clean_summary):
                final_excerpt = scraped_excerpt

            # 3. Fallback/Transformation Logic
            # If we have a video, prioritize its thumbnail as the main image to ensure visual consistency
            if video_url and "youtube.com/embed/" in video_url:
                video_id = video_url.split("youtube.com/embed/")[1].split("?")[0].split("/")[0]
                video_thumb = f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"
                
                # Use video thumbnail if no image exists OR if the current image is a generic fallback/placeholder
                if not image_url or "unsplash.com" in image_url or "placeholder" in image_url.lower():
                    image_url = video_thumb
                    logger.info(f"Prioritizing YouTube thumbnail for consistency: {image_url}")

            # Final check: Don't let video URLs leak into image_url field unless they are thumbnails
            if image_url and any(ext in image_url.lower() for ext in ["youtube.com/embed/", "player.vimeo.com", ".mp4", ".mov"]):
                if "youtube.com/embed/" in image_url:
                    video_id = image_url.split("youtube.com/embed/")[1].split("?")[0].split("/")[0]
                    # Attempt to extract video URL if not already found
                    if not video_url: video_url = image_url
                    image_url = f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"
                else:
                    image_url = None # Let fallback logic handle it

            # --- Pre-Fallback Sanitization to Reject Bad Images / Fix Res ---
            if image_url:
                image_url = image_url.strip()
                # Reject known generic stubs, logos, and tiny thumbnails
                bad_keywords = [
                    'genric_yahoo', 'default-thumbnail', 'placeholder', 'w=240;h=56', 'w=56;h=56', 'yahoo-sports-logo',
                    'yahoo_frontpage', 'world_news_2', 'tass_logo_share', 'seekingalpha.com/assets/og_image',
                    'reuters.com/pf/resources/images/reuters/reuters-default.png'
                ]
                if '108x81' in image_url.lower() and 'investing.com' not in image_url.lower():
                    # Reject standard tiny thumbnails
                    image_url = None
                elif any(k in image_url.lower() for k in bad_keywords):
                    logger.info(f"Rejecting bad/generic image URL before fallback: {image_url}")
                    image_url = None
                
                # Fix Investing.com thumbnail sizing 
                if image_url and "investing.com" in image_url and re.search(r'_\d+x\d+', image_url):
                    image_url = re.sub(r'_\d+x\d+', '', image_url)
                    logger.info(f"Upgraded investing.com image resolution: {image_url}")

                # Fix b-cdn.net (Phys.org and others) thumbnail sizing
                if image_url and "b-cdn.net" in image_url and "/tmb/" in image_url:
                    image_url = image_url.replace("/tmb/", "/800a/")
                    logger.info(f"Upgraded b-cdn.net image resolution: {image_url}")

            if not image_url:
                # Fallback to topic-based images with significantly more variety
                # Mapping keys to match the core categories from sanitize_topic across the app
                placeholder_pools = {
                    "Sports": [
                        "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=1000",
                        "https://images.unsplash.com/photo-1504450758481-7338eba7524a?q=80&w=1000",
                        "https://images.unsplash.com/photo-1541252260730-0412e8e2108e?q=80&w=1000",
                        "https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=1000",
                        "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?q=80&w=1000",
                        "https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?q=80&w=1000",
                        "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=1000",
                        "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=1000"
                    ],
                    "Tech & Science": [
                        "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?q=80&w=1000",
                        "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1000",
                        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1000",
                        "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1000",
                        "https://images.unsplash.com/photo-1531297484001-80022131f5a1?q=80&w=1000",
                        "https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?q=80&w=1000",
                        "https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=1000",
                        "https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=1000"
                    ],
                    "Entertainment": [
                        "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1000",
                        "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=1000",
                        "https://images.unsplash.com/photo-1499364615650-68d98fa21442?q=80&w=1000",
                        "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1000",
                        "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1000",
                    ],
                    "Gaming": [
                        "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1000",
                        "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=1000",
                        "https://images.unsplash.com/photo-1499364615650-68d98fa21442?q=80&w=1000",
                        "https://images.unsplash.com/photo-1603190287605-e6ade32fa852?q=80&w=1000"
                    ],
                    "News & Politics": [
                        "https://images.unsplash.com/photo-1495020689067-958852a7765e?q=80&w=1000",
                        "https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=1000",
                        "https://images.unsplash.com/photo-1476242484419-cf5c5d4462bc?q=80&w=1000",
                        "https://images.unsplash.com/photo-1588681664899-f142ff2dc9b1?q=80&w=1000",
                        "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?q=80&w=1000",
                        "https://images.unsplash.com/photo-1504462385-551ad9874329?q=80&w=1000",
                        "https://images.unsplash.com/photo-1517048676732-d65bc937f952?q=80&w=1000",
                        "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1000"
                    ],
                    "Business & Money": [
                        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1000",
                        "https://images.unsplash.com/photo-1518458028785-8fbcd101ebb9?q=80&w=1000",
                        "https://images.unsplash.com/photo-1554224155-672629188047?q=80&w=1000",
                        "https://images.unsplash.com/photo-1518186285589-2f7649de83e0?q=80&w=1000"
                    ],
                    "Lifestyle & Culture": [
                        "https://images.unsplash.com/photo-1498837167922-ddd27525d352?q=80&w=1000",
                        "https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=1000",
                        "https://images.unsplash.com/photo-1490818387583-1baba5e638af?q=80&w=1000",
                        "https://images.unsplash.com/photo-1511632765486-a019a0e636bd?q=80&w=1000"
                    ],
                    "Knowledge": [
                        "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=1000",
                        "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=1000",
                        "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=1000"
                    ]
                }
                
                # Deterministically pick an image from the pool based on article URL
                import hashlib
                pool = placeholder_pools.get(topic, placeholder_pools["News & Politics"])
                url_hash = int(hashlib.md5(url.encode()).hexdigest(), 16)
                image_url = pool[url_hash % len(pool)]
                
                logger.info(f"Using varied fallback image for category '{topic}': {image_url}")

            # --- Final Sanitization for all images ---
            if image_url:
                image_url = image_url.strip()
                if image_url.startswith('//'):
                    image_url = 'https:' + image_url
                
                # Fix doubled domain issue (e.g. domain.com/domain.com/path)
                parts = image_url.split('/')
                if len(parts) > 4 and parts[2] == parts[3] and '.' in parts[2]:
                    # parts[2] is the domain, check if parts[3] is the same domain
                    new_parts = parts[:3] + parts[4:]
                    image_url = '/'.join(new_parts)
                    logger.info(f"Fixed doubled domain image URL: {image_url}")


            if image_url:
                logger.info(f"Final image for article '{title}': {image_url}")
            else:
                logger.warning(f"No image found for article '{title}' even with fallback!")

            # 4. Language detection
            article_lang = feed_language
            
            # Try to get from feed/entry level first
            feed_level_lang = None
            if hasattr(d, 'feed') and d.feed.get('language'):
                feed_level_lang = d.feed.get('language').split('-')[0].lower()
            elif entry.get('language'):
                feed_level_lang = entry.get('language').split('-')[0].lower()
            
            if feed_level_lang and feed_level_lang != 'en':
                article_lang = feed_level_lang

            # Always try to detect for maximum accuracy, especially if we have 'en'
            try:
                # Use title + summary for detection
                detection_text = f"{title} {clean_summary}"
                if len(detection_text.strip()) > 20:
                    detected = detect(detection_text)
                    # If we detect something non-English, or if the current guess is 'en' but detection says otherwise
                    if detected != 'en' or article_lang == 'en':
                        article_lang = detected
            except Exception as e:
                logger.debug(f"Language detection failed for {url}: {e}")

            article = {
                "article_title": title,
                "article_url": url,
                "article_excerpt": final_excerpt[:1500],
                "article_image_url": image_url,
                "video_url": video_url,
                "topic": topic,
                "source_name": feed_name or self.clean_source_name(getattr(d.feed, 'title', feed_url)),
                "published_at": published_at,
                "language": article_lang,
                "country": feed_country
            }
            
            # Save incrementally for better tracking
            try:
                db.execute("""
                    INSERT INTO news_articles (title, url, excerpt, image_url, video_url, source_name, topic, published_at, language, country)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (url) DO NOTHING
                """, (
                    article["article_title"],
                    article["article_url"],
                    article["article_excerpt"],
                    article["article_image_url"],
                    article.get("video_url"),
                    article["source_name"],
                    article["topic"],
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
            future_to_feed = {executor.submit(self.fetch_feed, f["url"], f.get("name"), f.get("topic"), f.get("language"), f.get("country")): f for f in feeds}
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
