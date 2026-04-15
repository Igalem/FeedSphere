---
name: Feed Manager
description: Robust management of RSS feed sources, including batch discovery, verification, and database integration with custom activity filters.
---

# Feed Manager Skill

This skill provides automated tools to manage the FeedSphere RSS ecosystem.

## Capabilities

- **Add Feeds**: Batch process multiple RSS URLs, verify their content structure, and filter by activity (e.g., last 15 days by default).
- **Update Metadata**: Change defaults (like country or language) across all feed sources.
- **Health Checks**: Verify which feeds are no longer active or are consistently failing.
- **Manual Ingestion**: Bypass automated verification for reputable but unreachable sources (e.g., sites behind strict firewalls or DNS blocks).

## Usage

### Environment Setup

Before running the scripts, ensure your `NODE_PATH` points to the `feedsphere/node_modules` directory to resolve dependencies like `rss-parser` and `pg`.

```bash
export NODE_PATH=$(pwd)/feedsphere/node_modules
```

### Adding Feeds (Automated)

Use the `add_feeds.js` script to verify and insert new sources. This script automatically checks for XML validity and recent activity.

```bash
node .agent/skills/FeedManager/scripts/add_feeds.js [JSON_FEED_LIST_FILE] [DELTA_DAYS]
```

### Adding Feeds (Manual Bypass)

If a source is unreachable from the environment but verified manually (e.g., via browser or archival tools like Wayback Machine), insert it directly into the `rss_feeds` table.

**Important Policies**:
1. **No Sub-topics**: The `sub_topic` column has been removed. Use the main `topic` field only.
2. **Short Names**: Keep feed names concise. Remove everything after separators like `—`, `:`, or `|`. 
3. **Metadata**: Always include the `created_at` field (defaulting to `NOW()`) and the `domain` (extracted from the URL). Ensure topics align with `lib/topics.js`.
4. **Seed Snapshot**: Every automated ingestion or full check automatically updates the `feedsphere/sql/seed_rss_feeds.sql` file using `feedsphere/scripts/dump_seed_feeds.js`. This file serves as the ground truth for repo initialization.

```sql
INSERT INTO rss_feeds (name, url, topic, country, created_at) 
VALUES ('Name', 'https://site.com/feed', 'Topic', 'Country', NOW());
```

## Code Patterns

The skill uses the internal `lib/db.js` for persistent storage, maintaining consistency with the Next.js frontend and Python pipeline. All feed entries must adhere to the standardized topic list in `feedsphere/lib/topics.js`.
