import { CONFIG } from '../../shared/config';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

// Quota tracking: resets daily at midnight Pacific Time
let quotaUsedToday = 0;
let lastResetDatePacific = getPacificDateString();

function getPacificDateString(): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function checkAndResetQuota(): void {
  const todayPacific = getPacificDateString();
  if (todayPacific !== lastResetDatePacific) {
    quotaUsedToday = 0;
    lastResetDatePacific = todayPacific;
  }
}

export function recordQuotaUsage(units: number): void {
  checkAndResetQuota();
  quotaUsedToday += units;
}

export function getYouTubeQuotaUsedToday(): number {
  checkAndResetQuota();
  return quotaUsedToday;
}

export async function getCached<T>(key: string): Promise<T | null> {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data as T;
}

export async function setCached<T>(key: string, data: T, ttlMs = CONFIG.YOUTUBE_CACHE_TTL_MS): Promise<void> {
  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

// ----------------------------------------------------
// Stubs for Phase 3 Implementation
// ----------------------------------------------------
export interface YouTubeChannelDetails {
  channelId: string;
  title: string;
  description: string;
  customUrl?: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  thumbnailUrl: string;
}

export interface YouTubeVideoDetails {
  videoId: string;
  title: string;
  description: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  tags: string[];
}

export async function fetchChannelByHandle(handle: string): Promise<YouTubeChannelDetails | null> {
  checkAndResetQuota();
  const cacheKey = `yt:channel:${handle}`;
  const cached = await getCached<YouTubeChannelDetails>(cacheKey);
  if (cached) return cached;

  // Stubbed implementation for Phase 1; full implementation in Phase 3
  const stub: YouTubeChannelDetails = {
    channelId: `ch_${handle}`,
    title: `${handle} Official`,
    description: 'Tech and lifestyle creator reviews and daily updates.',
    customUrl: `@${handle}`,
    subscriberCount: 245000,
    videoCount: 180,
    viewCount: 15400000,
    thumbnailUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&h=120&fit=crop',
  };
  await setCached(cacheKey, stub);
  recordQuotaUsage(1);
  return stub;
}

export async function fetchChannelRecentVideos(channelId: string, limit = 10): Promise<YouTubeVideoDetails[]> {
  checkAndResetQuota();
  const cacheKey = `yt:videos:${channelId}:${limit}`;
  const cached = await getCached<YouTubeVideoDetails[]>(cacheKey);
  if (cached) return cached;

  const stubs: YouTubeVideoDetails[] = [
    {
      videoId: 'vid_01',
      title: 'Top 5 Tech Gadgets of 2026 - Real World Tests',
      description: 'Reviewing the best productivity gear and everyday carry tech.',
      publishedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      viewCount: 142000,
      likeCount: 8200,
      commentCount: 640,
      tags: ['tech', 'reviews', 'gadgets'],
    },
  ];
  await setCached(cacheKey, stubs);
  recordQuotaUsage(1);
  return stubs;
}
