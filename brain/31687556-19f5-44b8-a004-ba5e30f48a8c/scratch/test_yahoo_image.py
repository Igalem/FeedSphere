import os
import sys
import requests
from bs4 import BeautifulSoup

sys.path.append(os.path.abspath(os.path.dirname(__file__) + '/../..'))
from pipeline.crawler import BROWSER_HEADERS

def test_yahoo(url):
    print(f"Testing Yahoo URL: {url}")
    try:
        res = requests.get(url, headers=BROWSER_HEADERS, timeout=10)
        print(f"Status: {res.status_code}")
        if res.status_code == 200:
            soup = BeautifulSoup(res.text, "html.parser")
            
            # Check meta tags
            og_image = soup.find("meta", property="og:image")
            print(f"OG Image: {og_image.get('content') if og_image else 'NOT FOUND'}")
            
            twitter_image = soup.find("meta", name="twitter:image")
            print(f"Twitter Image: {twitter_image.get('content') if twitter_image else 'NOT FOUND'}")
            
            # Check for images in body
            images = soup.find_all("img")
            print(f"Total images found: {len(images)}")
            for i in images[:10]:
                src = i.get("src") or i.get("data-src")
                print(f"Img src: {src}")
    except Exception as e:
        print(f"Error: {e}")

test_yahoo("https://sports.yahoo.com/articles/inter-milan-want-70-million-124500430.html")
