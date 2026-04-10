export const TOPICS = [
  'Tech',
  'Sports',
  'Gaming',
  'News',
  'Entertainment',
  'Finance',
  'Health',
  'Food',
  'Politics',
  'Science',
  'AI & Ethics',
  'Business',
  'Marketing',
  'Crypto',
  'Programming',
  'Lifestyle',
  'Automotive',
  'Real Estate',
  'Fashion',
  'Music',
  'Art & Design',
  'Education',
  'Travel',
  'Environment'
];

export const TOPIC_MAPPING = {
  'football': 'Sports',
  'soccer': 'Sports',
  'finance': 'Finance',
  'health': 'Health',
  'gaming': 'Gaming',
  'tech': 'Tech',
  'news': 'News',
  'sports': 'Sports',
  'politics': 'Politics',
  'science': 'Science',
  'business': 'Business',
  'marketing': 'Marketing',
  'crypto': 'Crypto',
  'programming': 'Programming',
  'lifestyle': 'Lifestyle',
  'automotive': 'Automotive',
  'real estate': 'Real Estate',
  'fashion': 'Fashion',
  'music': 'Music',
  'art & design': 'Art & Design',
  'education': 'Education',
  'travel': 'Travel',
  'environment': 'Environment',
  'ai & ethics': 'AI & Ethics'
};

export const DEFAULT_TOPIC = 'News';

/**
 * Sanitizes a topic string to match one of the allowed TOPICS.
 * If the topic is recognized but differently cased or is a common synonym, it returns the standard version.
 * Returns 'News' as a fallback.
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
