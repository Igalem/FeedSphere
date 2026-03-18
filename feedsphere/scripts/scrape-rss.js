const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function scrape() {
  console.log('Fetching README from GitHub...');
  const res = await fetch('https://raw.githubusercontent.com/plenaryapp/awesome-rss-feeds/master/README.md');
  if (!res.ok) {
    console.error(`Failed to fetch: ${res.status} ${res.statusText}`);
    return;
  }
  const text = await res.text();

  const customFeeds = [
    {
      name: 'Barca Blaugranes',
      url: 'https://www.barcablaugranes.com/rss/index.xml',
      category: 'Football',
      topic: 'Sports',
      domain: 'www.barcablaugranes.com'
    },
    {
      name: 'Barca Universal',
      url: 'https://barcauniversal.com/feed/',
      category: 'Football',
      topic: 'Sports',
      domain: 'barcauniversal.com'
    },
    {
      name: 'BarcaBlog',
      url: 'https://barcablog.com/feed',
      category: 'Football',
      topic: 'Sports',
      domain: 'barcablog.com'
    },
    {
      name: 'PlayStation Blog',
      url: 'https://blog.playstation.com/feed/',
      category: 'PlayStation',
      topic: 'Gaming',
      domain: 'blog.playstation.com'
    },
    {
      name: 'PSU (PlayStation Universe)',
      url: 'https://www.psu.com/feed/?post_type=psu_news',
      category: 'PlayStation',
      topic: 'Gaming',
      domain: 'www.psu.com'
    },
    {
      name: 'PlayStation LifeStyle',
      url: 'https://www.playstationlifestyle.net/feed/',
      category: 'PlayStation',
      topic: 'Gaming',
      domain: 'www.playstationlifestyle.net'
    },
    {
      name: 'PS Blog (Feedburner)',
      url: 'https://feeds.feedburner.com/psblog',
      category: 'PlayStation',
      topic: 'Gaming',
      domain: 'feeds.feedburner.com'
    },
    {
      name: 'Gaming.News',
      url: 'https://gaming.news/feed/',
      category: 'Gaming',
      topic: 'Gaming',
      domain: 'gaming.news'
    },
    {
      name: 'Time World',
      url: 'https://feeds.feedburner.com/time/world',
      category: 'World',
      topic: 'News',
      domain: 'feeds.feedburner.com'
    },
    {
      name: 'Washington Post World',
      url: 'https://feeds.washingtonpost.com/rss/world',
      category: 'World',
      topic: 'News',
      domain: 'feeds.washingtonpost.com'
    }
  ];

  const lines = text.split('\n');
  let currentCategory = 'General';
  let currentTopic = 'General';
  
  const feeds = [...customFeeds];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Detect Category
    if (line.startsWith('## ') || line.startsWith('### ')) {
      currentCategory = line.replace(/^#+ /, '').trim();
      currentTopic = inferTopic(currentCategory);
      continue;
    }
    
    // Detect Table Row
    // Matches lines with at least one pipe, containing 'http'
    if (line.includes('|') && line.includes('http') && !line.includes('---')) {
      const parts = line.split('|').map(p => p.trim()).filter(p => p !== '');
      
      // Skip if it looks like a header (contains 'Source' and 'Url')
      const isHeader = parts.some(p => p.toLowerCase().includes('source')) && 
                       (parts.some(p => p.toLowerCase().includes('url') || p.toLowerCase().includes('feed')));
      
      if (!isHeader && parts.length >= 2) {
        const name = parts[0];
        const url_part = parts.find(p => p.startsWith('http'));
        
        if (url_part) {
          const url = url_part;
          try {
            const domain = new URL(url).hostname;
            feeds.push({
              name: name.substring(0, 255), // Sanity limit
              url,
              category: currentCategory,
              topic: currentTopic,
              domain
            });
          } catch (e) {
            // Invalid URL, skip
          }
        }
      }
    }
  }

  console.log(`Found ${feeds.length} feeds. Inserting into database...`);

  if (feeds.length === 0) {
    console.log('No feeds found. Check parsing logic.');
    return;
  }

  const client = await pool.connect();
  try {
    for (const feed of feeds) {
      await client.query(`
        INSERT INTO public.rss_feeds (name, url, category, topic, domain)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (url) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          topic = EXCLUDED.topic,
          domain = EXCLUDED.domain
      `, [feed.name, feed.url, feed.category, feed.topic, feed.domain]);
    }
    console.log('Successfully populated rss_feeds table.');
  } catch (err) {
    console.error('Error inserting feeds:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

function inferTopic(category) {
    const cat = category.toLowerCase();
    if (cat.includes('news')) return 'News';
    if (cat.includes('tech') || cat.includes('programming') || cat.includes('android') || cat.includes('ios') || cat.includes('web')) return 'Tech';
    if (cat.includes('game') || cat.includes('gaming')) return 'Gaming';
    if (cat.includes('sport') || cat.includes('cricket') || cat.includes('football') || cat.includes('tennis')) return 'Sports';
    if (cat.includes('tv') || cat.includes('movie') || cat.includes('series') || cat.includes('drama')) return 'TV Shows';
    if (cat.includes('science') || cat.includes('space')) return 'Science';
    if (cat.includes('business') || cat.includes('finance') || cat.includes('economy')) return 'Business';
    
    // Simplified check for common country emoji patterns (flag symbols)
    if (category.includes('🇦') || category.includes('🇮') || category.includes('🇺') || category.includes('🇬') || category.includes('🇫') || category.includes('🇷') || category.includes('🇨') || category.includes('🇧')) return 'News';
    
    return 'General';
}

scrape();
