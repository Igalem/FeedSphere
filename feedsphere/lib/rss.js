import Parser from 'rss-parser';
import { decode } from 'html-entities';

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

      const isTracker = (u) => {
        if (!u) return false;
        return u.includes('secure-uk.imrworldwide.com') || 
               u.includes('pixel.wp.com') || 
               u.includes('doubleclick.net') ||
               u.includes('/cgi-bin/m?');
      };

      if (isTracker(imageUrl)) imageUrl = '';

      // Decode HTML entities in title and snippet
      const title = item.title ? decode(item.title.trim()) : 'Untitled';
      const rawSnippet = item.contentSnippet?.trim() || item.content?.trim() || '';
      const snippet = decode(rawSnippet);

      return {
        title: title,
        link: item.link?.trim(),
        snippet: snippet,
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
