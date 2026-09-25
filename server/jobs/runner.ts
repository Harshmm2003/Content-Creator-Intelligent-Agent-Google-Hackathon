import { Job, JobStatus } from '../../shared/types';
import { CONFIG } from '../../shared/config';
import { getRepositories } from '../repositories';
import { AppError } from '../errors/AppError';

export type JobHandler = (
  job: Job,
  updateProgress: (done: number, total: number, message: string) => Promise<void>,
  isCancelled: () => boolean
) => Promise<unknown>;

class JobRunner {
  private activeJobs = new Map<string, { cancelRequested: boolean }>();

  async createJob(
    type: string,
    campaignId: string,
    ownerId: string,
    handler: JobHandler
  ): Promise<Job> {
    const repos = getRepositories();

    // Check if there is already a running job of this type for this campaign
    const existing = await repos.jobs.findRunningJob(campaignId, type);
    if (existing) {
      // Check timeout
      const runningMs = Date.now() - new Date(existing.updatedAt).getTime();
      if (runningMs > CONFIG.JOB_TIMEOUT_MINUTES * 60 * 1000) {
        await repos.jobs.update(existing.id, {
          status: JobStatus.FAILED,
          error: { code: 'JOB_TIMEOUT', message: 'Job timed out and was automatically terminated' },
        });
      } else {
        return existing;
      }
    }

    const job = await repos.jobs.create({
      campaignId,
      ownerId,
      type,
      status: JobStatus.QUEUED,
      progress: { done: 0, total: 100, message: 'Job queued' },
      result: null,
      error: null,
      cancelRequested: false,
    });

    this.activeJobs.set(job.id, { cancelRequested: false });

    // Execute asynchronously in-process
    this.executeJob(job.id, handler).catch((err) => {
      console.error(`[JobRunner] Uncaught job error on ${job.id}:`, err);
    });

    return job;
  }

  private async executeJob(jobId: string, handler: JobHandler): Promise<void> {
    const repos = getRepositories();
    const active = this.activeJobs.get(jobId);

    try {
      await repos.jobs.update(jobId, {
        status: JobStatus.RUNNING,
        progress: { done: 0, total: 100, message: 'Processing started...' },
      });

      const updateProgress = async (done: number, total: number, message: string) => {
        await repos.jobs.update(jobId, {
          progress: { done, total, message },
        });
      };

      const isCancelled = () => {
        return active?.cancelRequested ?? false;
      };

      const currentJob = await repos.jobs.getById(jobId);
      if (!currentJob) return;

      const result = await handler(currentJob, updateProgress, isCancelled);

      if (isCancelled()) {
        await repos.jobs.update(jobId, {
          status: JobStatus.CANCELLED,
          progress: { done: 100, total: 100, message: 'Job cancelled by user' },
        });
      } else {
        await repos.jobs.update(jobId, {
          status: JobStatus.SUCCEEDED,
          result: result ?? { success: true },
          progress: { done: 100, total: 100, message: 'Complete' },
        });
      }
    } catch (err: any) {
      console.error(`[JobRunner] Job ${jobId} failed:`, err);
      await repos.jobs.update(jobId, {
        status: JobStatus.FAILED,
        error: {
          code: err.code || 'JOB_FAILED',
          message: err.message || 'Job execution encountered an error',
        },
      });
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  async getJob(jobId: string): Promise<Job> {
    const repos = getRepositories();
    const job = await repos.jobs.getById(jobId);
    if (!job) {
      throw AppError.notFound('Job not found');
    }

    // Check timeout if currently running
    if (job.status === JobStatus.RUNNING) {
      const runningMs = Date.now() - new Date(job.updatedAt).getTime();
      if (runningMs > CONFIG.JOB_TIMEOUT_MINUTES * 60 * 1000) {
        const timedOutJob = await repos.jobs.update(job.id, {
          status: JobStatus.FAILED,
          error: { code: 'JOB_TIMEOUT', message: 'Job timed out after exceeding limit' },
        });
        return timedOutJob;
      }
    }

    return job;
  }

  async cancelJob(jobId: string): Promise<Job> {
    const repos = getRepositories();
    const job = await this.getJob(jobId);

    if (job.status !== JobStatus.RUNNING && job.status !== JobStatus.QUEUED) {
      return job;
    }

    const active = this.activeJobs.get(jobId);
    if (active) {
      active.cancelRequested = true;
    }

    return await repos.jobs.update(jobId, {
      cancelRequested: true,
      status: JobStatus.CANCELLED,
    });
  }

  async getRunningJobsForCampaign(campaignId: string): Promise<Job[]> {
    const repos = getRepositories();
    const running = await repos.jobs.listRunningJobs(campaignId);
    const valid: Job[] = [];

    for (const job of running) {
      const runningMs = Date.now() - new Date(job.updatedAt).getTime();
      if (runningMs > CONFIG.JOB_TIMEOUT_MINUTES * 60 * 1000) {
        await repos.jobs.update(job.id, {
          status: JobStatus.FAILED,
          error: { code: 'JOB_TIMEOUT', message: 'Job timed out' },
        });
      } else {
        valid.push(job);
      }
    }
    return valid;
  }
}

export const jobRunner = new JobRunner();
