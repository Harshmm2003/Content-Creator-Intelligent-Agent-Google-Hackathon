import { z } from 'zod';
import { CONFIG } from './config';

// ----------------------------------------------------
// Error Codes & Types
// ----------------------------------------------------
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  UNPROCESSABLE: 'UNPROCESSABLE',
  RATE_LIMITED: 'RATE_LIMITED',
  AI_INVALID_OUTPUT: 'AI_INVALID_OUTPUT',
  AI_RATE_LIMITED: 'AI_RATE_LIMITED',
  AI_UNAVAILABLE: 'AI_UNAVAILABLE',
  INTERNAL: 'INTERNAL',
  UPSTREAM_ERROR: 'UPSTREAM_ERROR',
  JOB_TIMEOUT: 'JOB_TIMEOUT',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiErrorResponse {
  error: {
    code: ErrorCodeType | string;
    message: string;
    details?: Record<string, string[]> | unknown;
    retryable?: boolean;
    currentDocument?: unknown;
  };
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
}

// ----------------------------------------------------
// User
// ----------------------------------------------------
export const UserSchema = z.object({
  uid: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().default('User'),
  photoURL: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  lastLoginAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;

// ----------------------------------------------------
// Campaign Status & Transitions
// ----------------------------------------------------
export const CampaignStatus = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
} as const;

export type CampaignStatusType = (typeof CampaignStatus)[keyof typeof CampaignStatus];

export const ALLOWED_STATUS_TRANSITIONS: Record<CampaignStatusType, CampaignStatusType[]> = {
  draft: ['active', 'archived'],
  active: ['completed', 'archived'],
  completed: ['archived'],
  archived: ['draft'],
};

export function isValidStatusTransition(
  from: CampaignStatusType,
  to: CampaignStatusType
): boolean {
  if (from === to) return true;
  return ALLOWED_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

// ----------------------------------------------------
// Campaign Brief
// ----------------------------------------------------
export const TONE_OPTIONS = ['educational', 'funny', 'authentic', 'premium', 'energetic', 'calm'] as const;
export type ToneOption = (typeof TONE_OPTIONS)[number];

export const CampaignBriefSchema = z.object({
  brandName: z.string().trim().min(1, 'Brand name is required').max(80, 'Brand name cannot exceed 80 characters'),
  productName: z.string().trim().min(1, 'Product name is required').max(80, 'Product name cannot exceed 80 characters'),
  productCategory: z.string().trim().min(1, 'Product category is required'),
  landingPageUrl: z
    .string()
    .trim()
    .url('Must be a valid URL')
    .refine((url) => url.startsWith('https://'), 'URL must use secure https://'),
  approvedFacts: z
    .array(
      z.string().trim().min(5, 'Fact must be at least 5 characters').max(300, 'Fact cannot exceed 300 characters')
    )
    .min(1, 'At least 1 approved product fact is required')
    .max(20, 'Maximum 20 approved facts allowed'),
  competitors: z
    .array(z.string().trim().min(1, 'Competitor name cannot be empty').max(80, 'Competitor name too long'))
    .max(20, 'Maximum 20 competitors allowed')
    .default([]),
  bannedTerms: z
    .array(z.string().trim().min(1, 'Banned term cannot be empty').max(100, 'Banned term too long'))
    .max(50, 'Maximum 50 banned terms allowed')
    .default([]),
  nicheKeywords: z
    .array(z.string().trim().min(1, 'Keyword cannot be empty').max(50, 'Keyword too long'))
    .min(1, 'At least 1 niche keyword is required')
    .max(10, 'Maximum 10 niche keywords allowed')
    .default([]),
  targetAudience: z
    .string()
    .trim()
    .min(20, 'Target audience description must be at least 20 characters')
    .max(500, 'Target audience description cannot exceed 500 characters'),
  geography: z.string().trim().default('US'),
  tones: z
    .array(z.enum(TONE_OPTIONS))
    .min(1, 'Select at least one primary tone'),
  customTone: z.string().trim().max(100, 'Custom tone too long').optional(),
  budgetUsd: z
    .number({ invalid_type_error: 'Budget must be a number' })
    .positive('Budget must be greater than 0')
    .max(10_000_000, 'Budget cannot exceed $10,000,000'),
  goal: z.enum(['awareness', 'consideration', 'conversions'], {
    invalid_type_error: 'Goal must be awareness, consideration, or conversions',
  }),
  launchDate: z.string().min(1, 'Launch date is required'),
  requiredDisclosures: z.object({
    descriptionText: z.string().trim().default('#ad'),
    verbalText: z.string().trim().default('This video is sponsored by {brandName}.'),
  }).default({
    descriptionText: '#ad',
    verbalText: 'This video is sponsored by {brandName}.',
  }),
});

export type CampaignBrief = z.infer<typeof CampaignBriefSchema>;

export const UpdateBriefRequestSchema = z.object({
  brief: CampaignBriefSchema,
  version: z.number().int().min(1, 'Version is required for concurrency control'),
});
export type UpdateBriefRequest = z.infer<typeof UpdateBriefRequestSchema>;

export const PatchBriefRequestSchema = z.object({
  brief: CampaignBriefSchema.partial(),
  version: z.number().int().min(1, 'Version is required for concurrency control'),
});
export type PatchBriefRequest = z.infer<typeof PatchBriefRequestSchema>;

// ----------------------------------------------------
// Campaign Settings
// ----------------------------------------------------
export const ScoringWeightsSchema = z
  .object({
    brandFit: z.number().min(0).max(100),
    sentimentFit: z.number().min(0).max(100),
    authenticityFit: z.number().min(0).max(100),
  })
  .refine(
    (w) => w.brandFit + w.sentimentFit + w.authenticityFit === 100,
    'Scoring weights must sum exactly to 100%'
  );

export type ScoringWeights = z.infer<typeof ScoringWeightsSchema>;

export const CpmAssumptionsSchema = z
  .object({
    cpmLow: z.number().positive('Low CPM must be greater than 0'),
    cpmHigh: z.number().positive('High CPM must be greater than 0'),
  })
  .refine((c) => c.cpmLow <= c.cpmHigh, 'Low CPM assumption cannot be greater than High CPM');

export type CpmAssumptions = z.infer<typeof CpmAssumptionsSchema>;

export const CampaignSettingsSchema = z.object({
  scoringWeights: ScoringWeightsSchema.default(CONFIG.DEFAULT_SCORING_WEIGHTS),
  cpmAssumptions: CpmAssumptionsSchema.default({
    cpmLow: CONFIG.DEFAULT_CPM_LOW,
    cpmHigh: CONFIG.DEFAULT_CPM_HIGH,
  }),
  searchBudgetShare: z.number().min(0).max(50).default(CONFIG.DEFAULT_SEARCH_BUDGET_SHARE),
});

export type CampaignSettings = z.infer<typeof CampaignSettingsSchema>;

export const UpdateCampaignSettingsRequestSchema = z.object({
  settings: CampaignSettingsSchema,
  version: z.number().int().min(1, 'Version is required for concurrency control'),
});
export type UpdateCampaignSettingsRequest = z.infer<typeof UpdateCampaignSettingsRequestSchema>;

export const UpdateCampaignMembersRequestSchema = z.object({
  memberEmails: z
    .array(z.string().email('Invalid email address'))
    .max(CONFIG.MAX_MEMBERS_PER_CAMPAIGN, `Maximum ${CONFIG.MAX_MEMBERS_PER_CAMPAIGN} members allowed`),
  version: z.number().int().min(1, 'Version is required for concurrency control'),
});
export type UpdateCampaignMembersRequest = z.infer<typeof UpdateCampaignMembersRequestSchema>;

// ----------------------------------------------------
// Guidelines
// ----------------------------------------------------
export const GuidelineSchema = z.object({
  id: z.string().min(1),
  campaignId: z.string().min(1),
  code: z.string().min(1), // e.g. G-1, L-1
  type: z.enum(['brand', 'baseline']),
  title: z.string().trim().min(3, 'Title must be 3-100 characters').max(100, 'Title cannot exceed 100 characters'),
  text: z.string().trim().min(10, 'Rule text must be 10-3000 characters').max(3000, 'Rule text cannot exceed 3000 characters'),
  active: z.boolean().default(true),
  order: z.number().int().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  version: z.number().int().min(1).default(1),
});

export type Guideline = z.infer<typeof GuidelineSchema>;

export const CreateGuidelineRequestSchema = z.object({
  title: z.string().trim().min(3).max(100),
  text: z.string().trim().min(10).max(3000),
});
export type CreateGuidelineRequest = z.infer<typeof CreateGuidelineRequestSchema>;

export const UpdateGuidelineRequestSchema = z.object({
  title: z.string().trim().min(3).max(100).optional(),
  text: z.string().trim().min(10).max(3000).optional(),
  active: z.boolean().optional(),
  order: z.number().int().optional(),
  version: z.number().int().min(1, 'Version is required for concurrency control'),
});
export type UpdateGuidelineRequest = z.infer<typeof UpdateGuidelineRequestSchema>;

export const ReorderGuidelinesRequestSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});
export type ReorderGuidelinesRequest = z.infer<typeof ReorderGuidelinesRequestSchema>;

export const ImportGuidelinesTextRequestSchema = z.object({
  text: z.string().min(5, 'Text must have content to parse'),
});
export type ImportGuidelinesTextRequest = z.infer<typeof ImportGuidelinesTextRequestSchema>;

export const ConfirmImportGuidelinesRequestSchema = z.object({
  rules: z.array(
    z.object({
      title: z.string().trim().min(3).max(100),
      text: z.string().trim().min(10).max(3000),
    })
  ).min(1, 'At least one rule is required to import'),
});
export type ConfirmImportGuidelinesRequest = z.infer<typeof ConfirmImportGuidelinesRequestSchema>;

// ----------------------------------------------------
// Candidate Creators
// ----------------------------------------------------
export const CreatorStatus = {
  PENDING: 'pending',
  RESOLVED: 'resolved',
  UNRESOLVED: 'unresolved',
  ANALYZING: 'analyzing',
  ANALYZED: 'analyzed',
  ERROR: 'error',
} as const;

export type CreatorStatusType = (typeof CreatorStatus)[keyof typeof CreatorStatus];

export const CandidateCreatorSchema = z.object({
  id: z.string().min(1),
  campaignId: z.string().min(1),
  input: z.string().min(1),
  inputType: z.enum(['channelId', 'handle', 'url']),
  normalizedKey: z.string().min(1),
  status: z.enum(['pending', 'resolved', 'unresolved', 'analyzing', 'analyzed', 'error']).default('pending'),
  channel: z.record(z.string(), z.unknown()).nullable().default(null),
  metrics: z.record(z.string(), z.unknown()).nullable().default(null),
  scores: z.record(z.string(), z.unknown()).nullable().default(null),
  selected: z.boolean().default(false),
  plannedPublishDate: z.string().nullable().default(null),
  notes: z.string().max(1000, 'Notes cannot exceed 1000 characters').default(''),
  tags: z.array(z.string().max(30)).max(10, 'Maximum 10 tags allowed').default([]),
  error: z.string().nullable().default(null),
  analyzedAt: z.string().datetime().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  version: z.number().int().min(1).default(1),
});

export type CandidateCreator = z.infer<typeof CandidateCreatorSchema>;

export const CreateCreatorRequestSchema = z.object({
  input: z.string().trim().min(1, 'Creator input is required'),
});
export type CreateCreatorRequest = z.infer<typeof CreateCreatorRequestSchema>;

export const BulkCreateCreatorsRequestSchema = z.object({
  inputs: z.array(z.string().trim().min(1)).min(1, 'At least one creator is required'),
});
export type BulkCreateCreatorsRequest = z.infer<typeof BulkCreateCreatorsRequestSchema>;

export interface BulkCreatorResultItem {
  input: string;
  status: 'added' | 'duplicate' | 'invalid';
  reason?: string;
  creator?: CandidateCreator;
}

export interface BulkCreateCreatorsResponse {
  results: BulkCreatorResultItem[];
  addedCount: number;
  duplicateCount: number;
  invalidCount: number;
  totalCreatorsInCampaign: number;
}

export const UpdateCreatorRequestSchema = z.object({
  notes: z.string().max(1000).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  selected: z.boolean().optional(),
  plannedPublishDate: z.string().nullable().optional(),
  version: z.number().int().min(1, 'Version is required for concurrency control'),
});
export type UpdateCreatorRequest = z.infer<typeof UpdateCreatorRequestSchema>;

// ----------------------------------------------------
// Campaign Model
// ----------------------------------------------------
export const CampaignSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1),
  ownerEmail: z.string().email(),
  memberEmails: z.array(z.string().email()).default([]),
  name: z.string().min(3, 'Campaign name must be at least 3 characters').max(80, 'Campaign name cannot exceed 80 characters'),
  status: z.enum(['draft', 'active', 'completed', 'archived']).default('draft'),
  brief: CampaignBriefSchema.nullable().default(null),
  settings: CampaignSettingsSchema.nullable().default(null),
  guidelineCounters: z.object({
    brand: z.number().int().default(0),
    baseline: z.number().int().default(7),
  }).default({ brand: 0, baseline: 7 }),
  guidelineIndexStale: z.boolean().default(false),
  approvedLineup: z.array(z.string()).default([]),
  deletedAt: z.string().datetime().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  version: z.number().int().min(1).default(1),
});

export type Campaign = z.infer<typeof CampaignSchema>;

// ----------------------------------------------------
// Campaign API Schemas (Request/Response)
// ----------------------------------------------------
export const CreateCampaignRequestSchema = z.object({
  name: z.string().trim().min(3, 'Name must be at least 3 characters').max(80, 'Name must be at most 80 characters'),
});
export type CreateCampaignRequest = z.infer<typeof CreateCampaignRequestSchema>;

export const UpdateCampaignRequestSchema = z.object({
  name: z.string().trim().min(3).max(80).optional(),
  status: z.enum(['draft', 'active', 'completed', 'archived']).optional(),
  memberEmails: z.array(z.string().email()).optional(),
  version: z.number().int().min(1, 'Version is required for concurrency control'),
});
export type UpdateCampaignRequest = z.infer<typeof UpdateCampaignRequestSchema>;

export const DeleteCampaignRequestSchema = z.object({
  version: z.number().int().min(1),
});
export type DeleteCampaignRequest = z.infer<typeof DeleteCampaignRequestSchema>;

export const ListCampaignsQuerySchema = z.object({
  status: z.enum(['draft', 'active', 'completed', 'archived']).optional(),
  search: z.string().optional(),
  sort: z.enum(['updatedAt', 'name', 'createdAt']).default('updatedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(CONFIG.MAX_PAGE_SIZE).default(CONFIG.DEFAULT_PAGE_SIZE),
});
export type ListCampaignsQuery = z.infer<typeof ListCampaignsQuerySchema>;

// ----------------------------------------------------
// Campaign Activity Log
// ----------------------------------------------------
export const ActivitySchema = z.object({
  id: z.string().min(1),
  campaignId: z.string().min(1),
  actorEmail: z.string().email(),
  action: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  summary: z.string().min(1),
  at: z.string().datetime(),
});

export type Activity = z.infer<typeof ActivitySchema>;

// ----------------------------------------------------
// Campaign Import / Export
// ----------------------------------------------------
export const CampaignExportSchema = z.object({
  schemaVersion: z.string().default(CONFIG.SCHEMA_VERSION),
  campaign: CampaignSchema.omit({ id: true, ownerId: true, ownerEmail: true, deletedAt: true }),
  subcollections: z.object({
    creators: z.array(z.record(z.string(), z.unknown())).default([]),
    guidelines: z.array(z.record(z.string(), z.unknown())).default([]),
    premortemRuns: z.array(z.record(z.string(), z.unknown())).default([]),
    briefs: z.array(z.record(z.string(), z.unknown())).default([]),
    submissions: z.array(z.record(z.string(), z.unknown())).default([]),
    searchPack: z.array(z.record(z.string(), z.unknown())).default([]),
    trackedVideos: z.array(z.record(z.string(), z.unknown())).default([]),
    activity: z.array(ActivitySchema.omit({ id: true, campaignId: true })).default([]),
  }).default({
    creators: [],
    guidelines: [],
    premortemRuns: [],
    briefs: [],
    submissions: [],
    searchPack: [],
    trackedVideos: [],
    activity: [],
  }),
});
export type CampaignExport = z.infer<typeof CampaignExportSchema>;

// ----------------------------------------------------
// Jobs
// ----------------------------------------------------
export const JobStatus = {
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type JobStatusType = (typeof JobStatus)[keyof typeof JobStatus];

export const JobSchema = z.object({
  id: z.string().min(1),
  campaignId: z.string().min(1),
  ownerId: z.string().min(1),
  type: z.string().min(1),
  status: z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']),
  progress: z.object({
    done: z.number().nonnegative(),
    total: z.number().nonnegative(),
    message: z.string(),
  }),
  result: z.unknown().nullable().default(null),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).nullable().default(null),
  cancelRequested: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Job = z.infer<typeof JobSchema>;

// ----------------------------------------------------
// Health Check
// ----------------------------------------------------
export interface HealthResponse {
  status: 'ok' | 'degraded';
  database: 'ok' | 'error';
  secrets: {
    gemini: boolean;
    youtube: boolean;
    cloudNl: boolean;
  };
  youtubeQuotaUsedToday: number;
  appVersion: string;
  demoMode: boolean;
}
