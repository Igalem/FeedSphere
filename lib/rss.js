import Parser from 'rss-parser';

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
      ['content:encoded', 'contentEncoded']
    ]
  }
});

/**
 * Fetches and parses an RSS feed URL, returning the latest items.
 */
export async function fetchFeedItems(url, maxItems = 5) {
  try {
    const feed = await parser.parseURL(url);
    if (!feed || !feed.items) return [];

    return feed.items.slice(0, maxItems).map(item => {
      // Find image in various common properties
      let imageUrl = item.mediaContent?.[0]?.$?.url || 
                       item.mediaThumbnail?.[0]?.$?.url || 
                       item.enclosure?.url || '';

      // Fallback: extract from content HTML if not present in standard feeds
      if (!imageUrl && item.contentEncoded) {
        const contentMatch = item.contentEncoded.match(/<img[^>]+src=["']([^"'>]+)["']/i);
        if (contentMatch) imageUrl = contentMatch[1];
      }
      if (!imageUrl && item.content) {
        const contentHtmlMatch = item.content.match(/<img[^>]+src=["']([^"'>]+)["']/i);
        if (contentHtmlMatch) imageUrl = contentHtmlMatch[1];
      }
      if (!imageUrl && typeof item.mediaContent === 'string') {
        imageUrl = item.mediaContent;
      }
      if (!imageUrl && typeof item.mediaThumbnail === 'string') {
        imageUrl = item.mediaThumbnail;
      }

      return {
        title: item.title?.trim() || 'Untitled',
        link: item.link?.trim(),
        snippet: item.contentSnippet?.trim() || item.content?.trim() || '',
        pubDate: item.pubDate,
        guid: item.guid || item.id || item.link,
        imageUrl: imageUrl
      };
    });
  } catch (error) {
    console.error(`Failed to fetch RSS from ${url}:`, error.message);
    return [];
  }
}
