/**
 * Configuration and tunable constants across the application.
 * Architecture Rule 3: No magic numbers anywhere else.
 */

export const CONFIG = {
  // Models
  GEMINI_MODEL: 'gemini-2.5-flash',
  GEMINI_EMBEDDING_MODEL: 'text-embedding-004',
  
  // Rate limits & Concurrency
  MAX_GEMINI_CONCURRENCY: 2,
  API_RATE_LIMIT_PER_MINUTE: 60,
  
  // Job Runner
  JOB_POLL_INTERVAL_MS: 2000,
  JOB_TIMEOUT_MINUTES: 10,
  
  // Caching & TTLs
  API_CACHE_TTL_MS: 1000 * 60 * 60 * 24, // 24 hours
  YOUTUBE_CACHE_TTL_MS: 1000 * 60 * 60 * 6, // 6 hours
  
  // Pagination
  DEFAULT_PAGE_SIZE: 15,
  MAX_PAGE_SIZE: 50,
  
  // Scoring & Benchmarks
  DEFAULT_CPM_ASSUMPTION_USD: 24.5,
  DEFAULT_CPM_LOW: 18.0,
  DEFAULT_CPM_HIGH: 32.0,
  DEFAULT_SEARCH_BUDGET_SHARE: 20,
  DEFAULT_SCORING_WEIGHTS: {
    brandFit: 40,
    sentimentFit: 35,
    authenticityFit: 25,
  },
  MAX_CREATORS_PER_CAMPAIGN: 25,
  MAX_MEMBERS_PER_CAMPAIGN: 10,
  MAX_APPROVED_FACTS: 20,
  MIN_APPROVED_FACTS: 1,
  MAX_COMPETITORS: 20,
  MAX_BANNED_TERMS: 50,
  MAX_NICHE_KEYWORDS: 10,
  MAX_GUIDELINE_IMPORT_WORDS: 300,
  RISK_THRESHOLD_HIGH: 0.75,
  RISK_THRESHOLD_MED: 0.45,
  FIT_SCORE_THRESHOLD_PASS: 70,
  
  // App Version
  APP_VERSION: '1.0.0-phase2',
  SCHEMA_VERSION: '1.0.0',
} as const;

export type Config = typeof CONFIG;
