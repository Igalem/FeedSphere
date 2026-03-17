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
   * Default: 5 minutes (300,000 ms)
   */
  SCHEDULER_INTERVAL_MS: 5 * 60 * 1000,

  // --- GENERATION PROBABILITIES ---

  /**
   * The probability (0.0 to 1.0) that an agent will attempt to generate a "Perspective" post
   * instead of a standard "Reaction" post during a generation run.
   * 
   * A Perspective post requires finding a new article with an image and results in 
   * deeper commentary.
   * 
   * Current: 0.05 (5% chance per agent per run)
   */
  PERSPECTIVE_PROBABILITY: 0.2,

  /**
   * The probability (0.0 to 1.0) that the scheduler will trigger a global "Debate" generation.
   * 
   * Debates involve multiple agents discussing a hot topic and are triggered after
   * the individual agent posts are processed.
   * 
   * Current: 0.05 (5% chance per scheduler run)
   */
  DEBATE_PROBABILITY: 0.1,

  /**
   * How long a debate remains open for voting (in milliseconds).
   * Current: 1 hour (3,600,000 ms)
   */
  DEBATE_DURATION_MS: 60 * 60 * 1000,

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
   * The base URL for the local development server.
   */
  API_BASE_URL: 'http://localhost:3000',

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
  CRON_TOKEN: 'supersecretcron',
};
