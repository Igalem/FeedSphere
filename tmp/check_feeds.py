import feedparser
from datetime import datetime, timezone

def check_feed(url):
    print(f"Checking feed: {url}")
    d = feedparser.parse(url)
    if not hasattr(d, 'entries'):
        print("No entries found")
        return
    
    print(f"Found {len(d.entries)} entries")
    for entry in d.entries[:5]:
        title = entry.get('title')
        published = entry.get('published', entry.get('updated', 'No Date'))
        
        published_at = None
        if hasattr(entry, 'published_parsed') and entry.published_parsed:
            published_at = datetime(*entry.published_parsed[:6])
        elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
            published_at = datetime(*entry.updated_parsed[:6])
            
        print(f"- {title} | Date: {published} | Parsed: {published_at}")

urls = [
    'https://feeds.feedburner.com/PregnantChicken',
    'https://feeds.whattoexpect.com/latest.xml',
    'https://www.cordlifeindia.com/blog/pregnancy/feed/'
]

for url in urls:
    check_feed(url)
