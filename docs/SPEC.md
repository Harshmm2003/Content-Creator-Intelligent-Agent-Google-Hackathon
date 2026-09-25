# Creator Campaign Intelligence Agent (CCIA) - System Specification

## 1. System Overview & Product Context
Brand marketers use this app to run an end-to-end YouTube creator campaign:
1. **Candidate Creators**: Score and rank candidate creators using multi-dimensional fit.
2. **Pre-Mortem**: Simulate lineup risk before launch with scenario analysis.
3. **Personalized Briefs**: Generate customized creator briefs aligning brand safety & voice.
4. **Compliance Review**: Review creator video drafts for disclosure, brand safety, and talking points.
5. **Demand Capture**: Prepare a Google AI Max for Search campaign targeting creator-generated search demand.
6. **Live Pulse**: Monitor the live campaign with real-time video performance tracking and alerts.

## 2. Architecture Rules
1. **Secrets**: `GEMINI_API_KEY`, `YOUTUBE_API_KEY`, and `CLOUD_NL_API_KEY` are read exclusively on the server from environment secrets. They are never sent to the browser, logged, or included in any response.
2. **Strict Folder Separation**:
   - `server/services/`: `gemini.ts` and `youtube.ts` are the ONLY files that call external third-party APIs.
   - `server/repositories/`: The ONLY files that read or write the database, behind typed interfaces (`Repository<T>`).
   - `server/engines/`: Business logic, one folder per engine; pure functions wherever possible.
   - `server/routes/`: Thin HTTP handlers: authenticate, authorize, validate, call engine or repository, respond.
   - `server/jobs/`: Background in-process job runner with progress tracking, timeouts, and cancellation.
   - `shared/`: Types, zod schemas, configuration constants, formatting helpers shared across frontend and backend.
   - `src/`: React frontend only.
3. **No Magic Numbers**: `shared/config.ts` holds all tunable values (models, embeddings, scoring weights, thresholds, cache TTLs, polling intervals, CPM assumptions, page sizes, rate limits).
4. **Zod Validation**: Every request body, query string, route parameter is validated with Zod on the server. Every form is validated on the client with the same shared Zod schemas. Every Gemini and YouTube response is validated before use.
5. **No Business Logic in React Components**: Components call custom hooks; hooks consume a typed API client.

## 3. Data Model
- `users/{uid}`:
  - `email`: string
  - `displayName`: string
  - `photoURL`: string | null
  - `createdAt`: ISO timestamp
  - `lastLoginAt`: ISO timestamp
- `campaigns/{campaignId}`:
  - `ownerId`: string
  - `ownerEmail`: string
  - `memberEmails`: string[]
  - `name`: string (3–80 characters)
  - `status`: `'draft' | 'active' | 'completed' | 'archived'`
  - `brief`: BriefData | null (Phase 2)
  - `settings`: SettingsData | null (Phase 2)
  - `approvedLineup`: string[] (Phase 4)
  - `deletedAt`: ISO timestamp | null
  - `createdAt`: ISO timestamp
  - `updatedAt`: ISO timestamp
  - `version`: integer (for optimistic concurrency)
- `campaigns/{campaignId}/activity/{activityId}`:
  - `actorEmail`: string
  - `action`: string
  - `entityType`: string
  - `entityId`: string
  - `summary`: string
  - `at`: ISO timestamp
- Subcollections (implemented in later phases): `creators`, `guidelines`, `premortemRuns`, `briefs`, `submissions`, `searchPack`, `trackedVideos`, `alerts`, `pulseSummaries`.
- `jobs/{jobId}`:
  - `campaignId`: string
  - `ownerId`: string
  - `type`: string
  - `status`: `'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'`
  - `progress`: `{ done: number, total: number, message: string }`
  - `result`: unknown | null
  - `error`: `{ code: string, message: string } | null`
  - `cancelRequested`: boolean
  - `createdAt`: ISO timestamp
  - `updatedAt`: ISO timestamp
- `cache/{key}`:
  - `data`: unknown
  - `expiresAt`: number (timestamp ms)

## 4. API Endpoints
All endpoints are mounted under `/api/v1`.
- **Health**:
  - `GET /api/v1/health`: Unauthenticated. Returns system health, database status, secret availability, YouTube quota, app version.
- **Campaigns**:
  - `GET /api/v1/campaigns?status=&search=&sort=updatedAt|name|createdAt&order=asc|desc&cursor=`: List campaigns owned or joined.
  - `GET /api/v1/campaigns/trash`: List trashed campaigns owned by user.
  - `POST /api/v1/campaigns`: Create draft campaign.
  - `GET /api/v1/campaigns/:id`: Get campaign by ID.
  - `PATCH /api/v1/campaigns/:id`: Update campaign with optimistic locking (`version`).
  - `DELETE /api/v1/campaigns/:id`: Soft delete campaign (moves to trash).
  - `POST /api/v1/campaigns/:id/restore`: Restore campaign from trash.
  - `DELETE /api/v1/campaigns/:id/permanent`: Hard delete campaign and subcollections.
  - `POST /api/v1/campaigns/:id/duplicate`: Duplicate campaign.
  - `GET /api/v1/campaigns/:id/export`: Complete JSON export with schemaVersion.
  - `POST /api/v1/campaigns/import`: Validate export and create campaign.
  - `GET /api/v1/campaigns/:id/activity`: Activity log newest first.
- **Jobs**:
  - `GET /api/v1/jobs/:jobId`: Get job status.
  - `POST /api/v1/jobs/:jobId/cancel`: Request job cancellation.
  - `GET /api/v1/campaigns/:id/jobs?status=running`: Get running jobs for campaign.

## 5. Frontend Routes
- `/login`: Firebase Google Sign-In with returnTo support.
- `/campaigns`: Campaign dashboard with search, filter, sort, and actions.
- `/campaigns/trash`: Trash manager with restore and permanent delete with typed confirmation.
- `/campaigns/:campaignId`: Redirects to `/campaigns/:campaignId/overview`.
- `/campaigns/:campaignId/overview`: Overview with step checklist and "Continue" CTA.
- `/campaigns/:campaignId/brief`: Phase 2
- `/campaigns/:campaignId/guidelines`: Phase 2
- `/campaigns/:campaignId/creators`: Phase 3
- `/campaigns/:campaignId/creators/:creatorId`: Phase 3
- `/campaigns/:campaignId/premortem`: Phase 4
- `/campaigns/:campaignId/premortem/runs/:runId`: Phase 4
- `/campaigns/:campaignId/briefs`: Phase 5
- `/campaigns/:campaignId/briefs/:creatorId`: Phase 5
- `/campaigns/:campaignId/compliance`: Phase 6
- `/campaigns/:campaignId/compliance/new`: Phase 6
- `/campaigns/:campaignId/compliance/:submissionId`: Phase 6
- `/campaigns/:campaignId/search-capture`: Phase 7
- `/campaigns/:campaignId/live`: Phase 8
- `/campaigns/:campaignId/report`: Phase 8
- `/campaigns/:campaignId/settings`: Settings & team management
- `/demo`: Read-only demo mode

## 6. Error Codes
- `VALIDATION_ERROR` (400)
- `UNAUTHENTICATED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `CONFLICT` (409)
- `UNPROCESSABLE` (422)
- `RATE_LIMITED` (429)
- `AI_INVALID_OUTPUT` (500)
- `AI_RATE_LIMITED` (429)
- `AI_UNAVAILABLE` (503)
- `INTERNAL` (500)
- `UPSTREAM_ERROR` (502)

## 7. Decisions Log
- **Decision 1**: Firebase Auth verification uses public Google certs with caching via `jose` to verify ID tokens server-side securely without requiring a static private service account key.
- **Decision 2**: Dual repository architecture supports both Firestore backend and in-memory test/demo mock store seamlessly via `Repository<T>`.
- **Decision 3**: Gemini structured outputs enforce Zod validation with 1 automated repair retry loop, exponential backoff (1s, 2s, 4s), and concurrency throttling limited to 2 simultaneous requests.
