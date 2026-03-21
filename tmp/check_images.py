import feedparser
from bs4 import BeautifulSoup

def check_feed(url):
    print(f"Checking feed: {url}")
    d = feedparser.parse(url)
    if not hasattr(d, 'entries'):
        print("No entries found")
        return
    
    print(f"Found {len(d.entries)} entries")
    for entry in d.entries[:3]:
        title = entry.get('title')
        
        # Image check logic similar to lib/rss.js
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

        summary = entry.get("summary", entry.get("description", ""))
        if not image_url and summary:
            soup = BeautifulSoup(summary, "html.parser")
            img_tag = soup.find('img')
            if img_tag:
                image_url = img_tag.get('src')
                
        print(f"- {title} | Image: {image_url}")

urls = [
    'https://feeds.feedburner.com/PregnantChicken',
    'https://feeds.whattoexpect.com/latest.xml',
    'https://www.cordlifeindia.com/blog/pregnancy/feed/'
]

for url in urls:
    check_feed(url)
