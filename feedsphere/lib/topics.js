export const TOPICS = [
  'News & Politics',
  'Tech & Science',
  'Sports & Fitness',
  'Entertainment & Gaming',
  'Business & Money',
  'Lifestyle & Culture',
  'Knowledge'
];

export const TOPIC_MAPPING = {
  // Existing News-related keywords
  'news': 'News & Politics',
  'politics': 'News & Politics',
  'environment': 'News & Politics',
  'climate': 'News & Politics',
  'world': 'News & Politics',

  // Existing Tech-related keywords
  'tech': 'Tech & Science',
  'science': 'Tech & Science',
  'ai & ethics': 'Tech & Science',
  'programming': 'Tech & Science',
  'software': 'Tech & Science',
  'hardware': 'Tech & Science',

  // Existing Sports-related keywords
  'sports': 'Sports & Fitness',
  'health': 'Sports & Fitness',
  'fitness': 'Sports & Fitness',
  'football': 'Sports & Fitness',
  'soccer': 'Sports & Fitness',
  'basketball': 'Sports & Fitness',
  'nba': 'Sports & Fitness',
  'nfl': 'Sports & Fitness',

  // Existing Entertainment-related keywords
  'entertainment': 'Entertainment & Gaming',
  'gaming': 'Entertainment & Gaming',
  'music': 'Entertainment & Gaming',
  'movies': 'Entertainment & Gaming',
  'tv': 'Entertainment & Gaming',
  'culture': 'Entertainment & Gaming',

  // Existing Finance-related keywords
  'finance': 'Business & Money',
  'business': 'Business & Money',
  'money': 'Business & Money',
  'crypto': 'Business & Money',
  'real estate': 'Business & Money',
  'marketing': 'Business & Money',

  // Existing Lifestyle-related keywords
  'lifestyle': 'Lifestyle & Culture',
  'food': 'Lifestyle & Culture',
  'travel': 'Lifestyle & Culture',
  'fashion': 'Lifestyle & Culture',
  'automotive': 'Lifestyle & Culture',
  'cars': 'Lifestyle & Culture',

  // Existing Knowledge-related keywords
  'education': 'Knowledge',
  'art & design': 'Knowledge',
  'history': 'Knowledge',
  'books': 'Knowledge'
};

export const DEFAULT_TOPIC = 'News & Politics';

/**
 * Sanitizes a topic string to match one of the allowed TOPICS.
 * If the topic is recognized but differently cased or is a common synonym, it returns the standard version.
 * Returns 'News & Politics' as a fallback.
 */
export function sanitizeTopic(topic) {
  if (!topic) return DEFAULT_TOPIC;
  const lower = topic.toLowerCase().trim();
  
  // Direct mapping check (synonyms and casing)
  if (TOPIC_MAPPING[lower]) return TOPIC_MAPPING[lower];
  
  // Case-insensitive match in TOPICS list
  const found = TOPICS.find(t => t.toLowerCase() === lower);
  if (found) return found;

  return DEFAULT_TOPIC;
}
