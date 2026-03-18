---
name: rss_feed_management
description: Instructions for managing the rss_feeds table, including adding new feeds via the scraper or manual insertion.
---

# RSS Feed Management Skill

This skill provides instructions on how to manage the `rss_feeds` table in the FeedSphere database.

## 1. Structure of the `rss_feeds` Table

The table is defined in [schema.sql](file:///d:/Antigravity/FeedSphere/feedsphere/supabase/schema.sql) and contains:
- `name`: Display name of the feed.
- `url`: Unique RSS feed URL.
- `category`: Raw category from source (e.g., "Programming", "🇮🇩 Indonesia").
- `topic`: Normalized topic used for filtering (e.g., "News", "Tech", "Sports").
- `domain`: The root domain of the feed (e.g., "techcrunch.com").

## 2. Adding New Feeds via Scraper

To add feeds that should be persistent even when the scraper is rerun, update the `customFeeds` array in [scrape-rss.js](file:///d:/Antigravity/FeedSphere/feedsphere/scripts/scrape-rss.js).

### Steps:
1. Open `d:\Antigravity\FeedSphere\feedsphere\scripts\scrape-rss.js`.
2. Find the `customFeeds` array.
3. Add a new object following this format:
```javascript
{
  name: 'Feed Name',
  url: 'https://example.com/rss.xml',
  category: 'My Category',
  topic: 'Tech', // Choose from: Tech, News, Sports, Gaming, TV Shows, Science, Business, General
  domain: 'example.com'
}
```
4. Run the scraper:
```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/feedsphere"; node scripts/scrape-rss.js
```

## 3. Manual Insertion (One-off)

To add a feed quickly without modifying scripts:

```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/feedsphere"; node -e "const { Client } = require('pg'); const client = new Client({ connectionString: process.env.DATABASE_URL }); client.connect().then(() => client.query('INSERT INTO public.rss_feeds (name, url, category, topic, domain) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (url) DO NOTHING', ['Name', 'URL', 'Category', 'Topic', 'Domain'])).then(() => { console.log('Fixed'); client.end(); })"
```

## 4. Topic Mapping Logic

The scraper automatically infers topics. If you add a new category to the GitHub README that doesn't map correctly, update the `inferTopic` function in `scrape-rss.js`.

Current mappings:
- **News**: Includes "news" or country flag emojis.
- **Tech**: Includes "tech", "programming", "android", "ios", "web".
- **Sports**: Includes "sport", "cricket", "football", "tennis".
- **Gaming**: Includes "game", "gaming".
- **TV Shows**: Includes "tv", "movie", "series", "drama".
- **Science**: Includes "science", "space".
- **Business**: Includes "business", "finance", "economy".
