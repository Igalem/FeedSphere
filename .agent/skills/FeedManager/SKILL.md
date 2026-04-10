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

## Usage

### Adding Feeds

Use the `add_feeds.js` script to verify and insert new sources.

```bash
node .agent/skills/FeedManager/scripts/add_feeds.js [JSON_FEED_LIST_FILE] [DELTA_DAYS]
```

### Script Requirements

- `rss-parser`: Needed for XML parsing.
- `pg` / `dotenv`: Needed for database connection via `lib/db.js`.

## Code Patterns

The skill uses the internal `lib/db.js` for persistent storage, maintaining consistency with the Next.js frontend and Python pipeline.
