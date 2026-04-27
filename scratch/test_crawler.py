import asyncio
import logging
from pipeline.crawler import Crawler
from pipeline.config import settings

logging.basicConfig(level=logging.INFO)

def test_crawler():
    crawler = Crawler()
    # Let's try to fetch just one or two feeds to see what happens
    feeds = crawler.get_feeds()
    print(f"Total feeds in DB: {len(feeds)}")
    
    # Pick a feed and try to fetch it
    if feeds:
        feed = feeds[0]
        print(f"Testing feed: {feed['url']}")
        articles = crawler.fetch_feed(feed['url'], feed['name'], feed['topic'], feed['language'], feed['country'])
        print(f"Found {len(articles)} articles in this feed.")
        for a in articles[:3]:
            print(f"- {a['article_title']} (Published at: {a['published_at']})")

if __name__ == "__main__":
    test_crawler()
