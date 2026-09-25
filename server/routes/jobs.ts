import { Router, Request, Response, NextFunction } from 'express';
import { jobRunner } from '../jobs/runner';
import { getRepositories } from '../repositories';
import { CampaignEngine } from '../engines/campaigns/CampaignEngine';
import { AppError } from '../errors/AppError';

export const jobRouter = Router();

// GET /api/v1/jobs/:jobId
jobRouter.get(
  '/:jobId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const job = await jobRunner.getJob(req.params.jobId);

      // Verify that user is either owner or has access to campaign
      const repos = getRepositories();
      const campaign = await repos.campaigns.getById(job.campaignId);
      if (campaign) {
        CampaignEngine.authorizeAccess(campaign, user);
      } else if (job.ownerId !== user.uid) {
        throw AppError.notFound('Job not found');
      }

      res.json(job);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/jobs/:jobId/cancel
jobRouter.post(
  '/:jobId/cancel',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const job = await jobRunner.getJob(req.params.jobId);

      const repos = getRepositories();
      const campaign = await repos.campaigns.getById(job.campaignId);
      if (campaign) {
        CampaignEngine.authorizeAccess(campaign, user);
      } else if (job.ownerId !== user.uid) {
        throw AppError.notFound('Job not found');
      }

      const cancelled = await jobRunner.cancelJob(req.params.jobId);
      res.json(cancelled);
    } catch (err) {
      next(err);
    }
  }
);
