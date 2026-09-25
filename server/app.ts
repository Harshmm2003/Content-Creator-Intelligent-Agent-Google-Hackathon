import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { CONFIG } from '../shared/config';
import { HealthResponse } from '../shared/types';
import { requestIdMiddleware } from './middleware/requestId';
import { errorHandler } from './errors/errorHandler';
import { authenticateToken } from './middleware/auth';
import { rateLimiter } from './middleware/rateLimiter';
import { campaignRouter } from './routes/campaigns';
import { jobRouter } from './routes/jobs';
import { getRepositories } from './repositories';
import { getYouTubeQuotaUsedToday } from './services/youtube';
import { jobRunner } from './jobs/runner';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(requestIdMiddleware);

  // ----------------------------------------------------
  // Health endpoint (Public)
  // ----------------------------------------------------
  app.get('/api/v1/health', async (_req: Request, res: Response) => {
    let dbStatus: 'ok' | 'error' = 'ok';
    const repos = getRepositories();

    try {
      await repos.campaigns.list({ limit: 1 });
    } catch (e) {
      dbStatus = 'error';
    }

    const health: HealthResponse = {
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      database: dbStatus,
      secrets: {
        gemini: Boolean(process.env.GEMINI_API_KEY),
        youtube: Boolean(process.env.YOUTUBE_API_KEY),
        cloudNl: Boolean(process.env.CLOUD_NL_API_KEY),
      },
      youtubeQuotaUsedToday: getYouTubeQuotaUsedToday(),
      appVersion: CONFIG.APP_VERSION,
      demoMode: repos.isDemo,
    };

    res.json(health);
  });

  // ----------------------------------------------------
  // Campaign Jobs endpoint (Active jobs under campaign)
  // ----------------------------------------------------
  app.get(
    '/api/v1/campaigns/:id/jobs',
    authenticateToken,
    rateLimiter,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const campaignId = req.params.id;
        const runningJobs = await jobRunner.getRunningJobsForCampaign(campaignId);
        res.json({ items: runningJobs });
      } catch (err) {
        next(err);
      }
    }
  );

  // ----------------------------------------------------
  // Protected Routes
  // ----------------------------------------------------
  app.use('/api/v1/campaigns', authenticateToken, rateLimiter, campaignRouter);
  app.use('/api/v1/jobs', authenticateToken, rateLimiter, jobRouter);

  // Central error middleware
  app.use(errorHandler);

  return app;
}
