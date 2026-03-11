import Parser from 'rss-parser';

const parser = new Parser({
  customFields: {
    item: ['media:content', 'media:thumbnail']
  }
});

/**
 * Fetches and parses an RSS feed URL, returning the latest items.
 */
export async function fetchFeedItems(url, maxItems = 5) {
  try {
    const feed = await parser.parseURL(url);
    if (!feed || !feed.items) return [];

    return feed.items.slice(0, maxItems).map(item => ({
      title: item.title?.trim() || 'Untitled',
      link: item.link?.trim(),
      snippet: item.contentSnippet?.trim() || item.content?.trim() || '',
      pubDate: item.pubDate,
      guid: item.guid || item.id || item.link
    }));
  } catch (error) {
    console.error(`Failed to fetch RSS from ${url}:`, error.message);
    return [];
  }
}
