---
name: rss_feed_management
description: Instructions for managing the rss_feeds table, including adding new feeds via the scraper or manual insertion.
---

# RSS Feed Management Skill

This skill provides instructions on how to manage the `rss_feeds` table in the FeedSphere database.

## 1. Structure of the `rss_feeds` Table

The table is defined in [schema.sql](file:///Users/igalemona/repos/FeedSphere/feedsphere/supabase/schema.sql) and contains:
- `id`: UUID (Primary Key, auto-generated).
- `url`: Unique RSS feed URL.
- `name`: Display name of the feed.
- `topic`: Broad category used for filtering (e.g., "News", "Tech", "Sports").
- `sub_topic`: Specific niche (e.g., "Programming", "Football"). *Replaced the old 'category' column.*
- `domain`: The root domain of the feed (e.g., "techcrunch.com").
- `language`: Feed language (default: 'en').
- `country`: Origin country (default: 'World').
- `updated_at`: Timestamp of the last successful crawl.
- `created_at`: Timestamp when the feed was added.

## 2. Adding New Feeds via Scraper

To add feeds that should be persistent, update the `customFeeds` array in [scrape-rss.js](file:///Users/igalemona/repos/FeedSphere/feedsphere/scripts/scrape-rss.js).

> [!IMPORTANT]
> **Verification Requirement**: Only add feeds that have been updated within the last **15 days**. Dead or inactive feeds should be excluded to maintain feed freshness.

### Steps:
1. Open `feedsphere/scripts/scrape-rss.js`.
2. Find the `customFeeds` array.
3. Add a new object following this format:
```javascript
{
  name: 'Feed Name',
  url: 'https://example.com/rss.xml',
  sub_topic: 'Programming',
  topic: 'Tech', // Choose from: Tech, News, Sports, Gaming, Science, Business, Health, Food, Politics, Entertainment, Crypto
  domain: 'example.com'
}
```
4. Run the scraper (ensure `DATABASE_URL` is set in your environment or `.env.local`):
```bash
node feedsphere/scripts/scrape-rss.js
```

## 3. Manual Insertion (One-off)

To add a feed quickly via terminal (substituting your connection string):

```bash
psql $DATABASE_URL -c "INSERT INTO rss_feeds (name, url, topic, sub_topic, domain) VALUES ('Name', 'URL', 'Topic', 'Sub-Topic', 'Domain') ON CONFLICT (url) DO NOTHING;"
```

Or using the Python pipeline (ensure venv is active):
```bash
export PYTHONPATH=$PYTHONPATH:.
./.venv/bin/python3 -c "from pipeline.db import db; db.execute(\"INSERT INTO rss_feeds (name, url, topic, sub_topic, domain) VALUES (%s, %s, %s, %s, %s) ON CONFLICT (url) DO NOTHING\", ('Name', 'URL', 'Topic', 'Sub-Topic', 'Domain'))"
```

## 4. Advanced: Batch Discovery & Activity Filtering

For a more robust addition process that verifies if a feed is still active (e.g., has posted in the last **15 days**), refer to the [Feed Manager](file:///Users/igalemona/repos/FeedSphere/.agent/skills/FeedManager/SKILL.md) skill.

```bash
# Example: Adding feeds with a 15-day activity delta
node .agent/skills/FeedManager/scripts/add_feeds.js [JSON_FEED_LIST_FILE] 15
```

## 5. Topic Mapping Logic

The scraper infers `topic` from the `sub_topic` (or GitHub category). To adjust this logic, update the `inferTopic` function in `scrape-rss.js`.

Current mappings:
- **Tech**: android, ios, web, tech.
- **Programming**: coding, dev, programming.
- **Sports**: football, cricket, tennis, sport.
- **Gaming**: game, gaming.
- **Science**: science, space.
- **Finance**: crypto (fallback), finance.
- **Business**: business, economy.
- **Health**: medical, fitness, health.
- **Food**: food, cooking, recipe.
- **Entertainment**: tv, movie, music, entertainment.
- **News**: default fallback, or country flag emojis.
