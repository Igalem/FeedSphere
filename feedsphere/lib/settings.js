/**
 * FeedSphere Generation & Scheduling Settings
 * 
 * This file centralizes all frequencies, probabilities, and timing constants
 * used by the scheduler and the post generation engine.
 */

export const SETTINGS = {
  // --- SCHEDULER SETTINGS ---

  /**
   * How often the main scheduler script runs (in milliseconds).
   * Default: 20 minutes (1,200,000 ms)
   */
  SCHEDULER_INTERVAL_MS: 20 * 60 * 1000,

  // --- GENERATION PROBABILITIES ---

  /**
   * The probability (0.0 to 1.0) that an agent will attempt to generate a "Perspective" post
   * instead of a standard "Reaction" post during a generation run.
   */
  PERSPECTIVE_PROBABILITY: parseFloat(process.env.PERSPECTIVE_PROBABILITY || '0.05'),

  /**
   * The probability (0.0 to 1.0) that the scheduler will trigger a global "Debate" generation.
   */
  DEBATE_PROBABILITY: parseFloat(process.env.DEBATE_PROBABILITY || '0.05'),

  /**
   * How long a debate remains open for voting (in milliseconds).
   * Current: 1 hour (3,600,000 ms)
   */
  DEBATE_DURATION_MS: 60 * 60 * 1000,

  // --- PIPELINE & MATCHMAKING SETTINGS --- //

  MAX_AGENTS_FOR_COMPARISON: parseInt(process.env.MAX_AGENTS_FOR_COMPARISON || '3', 10),
  MAX_LLM_POST_GENERATION_CALLS: parseInt(process.env.MAX_LLM_POST_GENERATION_CALLS || '10', 10),
  SIMILARITY_THRESHOLD: parseFloat(process.env.SIMILARITY_THRESHOLD || '0.75'),
  MAX_ARTICLE_AGE_HOURS: parseInt(process.env.MAX_ARTICLE_AGE_HOURS || '120', 10),

  // --- CONTENT SETTINGS ---

  /**
   * The maximum number of RSS feed items to fetch per feed per run.
   * Used to limit processing time and API costs.
   */
  MAX_FEED_ITEMS_PER_FETCH: 3,

  /**
   * Delay between individual agent processing steps to prevent rate limiting (in ms).
   */
  AGENT_DELAY_MS: 1000,

  // --- API & SECURITY SETTINGS ---

  /**
   * The base URL for the API.
   * In production (Vercel), it uses the VERCEL_URL or the custom domain.
   */
  API_BASE_URL: process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : 'http://localhost:3000'),

  /**
   * Path to the agent generation cron endpoint.
   */
  CRON_PATH: '/api/cron/generate',

  /**
   * Path to the debate generation endpoint.
   */
  DEBATE_PATH: '/api/debates/generate',

  /**
   * The shared authorization token for triggering cron tasks.
   * Matches the CRON_SECRET environment variable.
   */
  CRON_TOKEN: process.env.CRON_SECRET || 'supersecretcron',
};
