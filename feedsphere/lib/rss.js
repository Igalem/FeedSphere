import Parser from 'rss-parser';
import { decode } from 'html-entities';

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
      ['content:encoded', 'contentEncoded']
    ]
  }
});

export async function fetchFeedItems(url, maxItems = 5) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': '*/*',
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Failed to fetch RSS from ${url}: Status code ${response.status}. Body: ${text.substring(0, 100)}`);
      return [];
    }

    const xml = await response.text();
    if (!xml || xml.trim().length === 0) {
      console.error(`Failed to fetch RSS from ${url}: Empty response.`);
      return [];
    }

    // Handle common non-XML responses that might start with text
    if (!xml.trim().startsWith('<')) {
      console.error(`Failed to fetch RSS from ${url}: Non-XML response starting with "${xml.trim().substring(0, 20)}..."`);
      return [];
    }

    const feed = await parser.parseString(xml);
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

      // Quality Upgrades
      if (imageUrl) {
        if (imageUrl.includes('img.youtube.com/vi/')) {
          imageUrl = imageUrl.replace(/\/(?:default|mqdefault|hqdefault|sddefault)\.jpg/, '/hq720.jpg');
        }
        if (imageUrl.includes('investing.com') && /_\d+x\d+/.test(imageUrl)) {
          imageUrl = imageUrl.replace(/_\d+x\d+/, '');
        }
        if (imageUrl.includes('b-cdn.net') && imageUrl.includes('/tmb/')) {
          imageUrl = imageUrl.replace('/tmb/', '/800a/');
        }
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

/**
 * Scrapes metadata (image, video) from an article URL if missing from RSS.
 * Used to ensure posts always have media.
 */
export async function scrapeMetadata(url) {
  if (!url) return { imageUrl: null, videoUrl: null };

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) return { imageUrl: null, videoUrl: null };

    const html = await response.text();

    // Image Extraction
    let imageUrl = null;
    const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"'>]+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"'>]+)["'][^>]+property=["']og:image["']/i);

    const twImageMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"'>]+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"'>]+)["'][^>]+name=["']twitter:image["']/i);

    imageUrl = ogImageMatch?.[1] || twImageMatch?.[1];

    // Video Extraction (YouTube/Vimeo)
    let videoUrl = null;
    const ytMatch = html.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
    if (ytMatch) {
      videoUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
    } else {
      const vimeoMatch = html.match(/https?:\/\/(?:www\.)?vimeo\.com\/(\d+)/i);
      if (vimeoMatch) {
        videoUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
      }
    }

    // Resolve relative image URL
    if (imageUrl && !imageUrl.startsWith('http')) {
      const baseUrl = new URL(url).origin;
      imageUrl = new URL(imageUrl, baseUrl).href;
    }

    // Fallback: If YouTube video but no image, use YouTube thumbnail
    if (videoUrl && videoUrl.includes('youtube.com/embed/') && !imageUrl) {
      const videoId = videoUrl.split('embed/')[1].split('?')[0];
      imageUrl = `https://img.youtube.com/vi/${videoId}/hq720.jpg`;
    }

    // Quality Upgrades
    if (imageUrl) {
      if (imageUrl.includes('img.youtube.com/vi/')) {
        imageUrl = imageUrl.replace(/\/(?:default|mqdefault|hqdefault|sddefault)\.jpg/, '/hq720.jpg');
      }
      if (imageUrl.includes('investing.com') && /_\d+x\d+/.test(imageUrl)) {
        imageUrl = imageUrl.replace(/_\d+x\d+/, '');
      }
      if (imageUrl.includes('b-cdn.net') && imageUrl.includes('/tmb/')) {
        imageUrl = imageUrl.replace('/tmb/', '/800a/');
      }

      // Fix Google News / Blogger / Picasa thumbnails
      if (imageUrl.includes('googleusercontent.com')) {
        if (imageUrl.includes('lh3.googleusercontent.com') && imageUrl.includes('=')) {
          imageUrl = imageUrl.replace(/=[^/]+$/, '=s0');
        } else if (imageUrl.includes('blogger.googleusercontent.com')) {
          imageUrl = imageUrl.replace(/\/s\d+[^/]*\//, '/s1600/');
        }
      }

      // Fix Dezeen thumbnails (e.g., -411x411.jpg)
      if (imageUrl.includes('static.dezeen.com') && /-\d+x\d+\.\w+$/.test(imageUrl)) {
        imageUrl = imageUrl.replace(/-\d+x\d+/, '');
      }

      // Fix SmallBizTrends thumbnails (e.g., -100x100.jpg)
      if (imageUrl.includes('smallbiztrends.com') && /-\d+x\d+\.\w+$/.test(imageUrl)) {
        imageUrl = imageUrl.replace(/-\d+x\d+/, '');
      }

      // Fix TSN.ua thumbnails (e.g., /thumbs/608xX/)
      if (imageUrl.includes('img.tsn.ua') && imageUrl.includes('/thumbs/')) {
        imageUrl = imageUrl.replace(/\/thumbs\/\d+x\w+\//, '/cached/1200/');
      }

      // Fix The Guardian thumbnails
      if (imageUrl.includes('i.guim.co.uk') && imageUrl.includes('width=')) {
        imageUrl = imageUrl.replace(/width=\d+/, 'width=1200').replace(/height=\d+/, 'height=630');
      }

      // Fix Ynet / Mako generic resizing patterns
      if (imageUrl.toLowerCase().includes('ynet.co.il') || imageUrl.toLowerCase().includes('mako.co.il')) {
        if (imageUrl.includes('w=')) imageUrl = imageUrl.replace(/w=\d+/, 'w=1200');
        if (imageUrl.includes('h=')) imageUrl = imageUrl.replace(/h=\d+/, 'h=675');
      }
    }

    return { imageUrl, videoUrl };
  } catch (err) {
    console.warn(`[Scraper] Failed for ${url}:`, err.message);
    return { imageUrl: null, videoUrl: null };
  }
}
