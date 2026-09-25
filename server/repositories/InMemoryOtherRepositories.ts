import { Activity, Job, User } from '../../shared/types';
import { SubcollectionRepository } from './Repository';

export class InMemoryActivityRepository implements SubcollectionRepository<Activity> {
  private activities = new Map<string, Activity[]>();

  async create(campaignId: string, data: Omit<Activity, 'id' | 'campaignId'>): Promise<Activity> {
    const list = this.activities.get(campaignId) || [];
    const newEntry: Activity = {
      ...data,
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      campaignId,
    };
    list.unshift(newEntry);
    this.activities.set(campaignId, list);
    return newEntry;
  }

  async list(campaignId: string, limit = 50): Promise<Activity[]> {
    const list = this.activities.get(campaignId) || [];
    return list.slice(0, limit);
  }

  async deleteAll(campaignId: string): Promise<number> {
    const count = this.activities.get(campaignId)?.length || 0;
    this.activities.delete(campaignId);
    return count;
  }
}

export class InMemoryJobRepository {
  private jobs = new Map<string, Job>();

  async create(data: Omit<Job, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Job> {
    const now = new Date().toISOString();
    const id = data.id || `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const job: Job = {
      ...data,
      id,
      result: data.result || null,
      error: data.error || null,
      cancelRequested: data.cancelRequested || false,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(id, job);
    return { ...job };
  }

  async getById(id: string): Promise<Job | null> {
    const j = this.jobs.get(id);
    return j ? { ...j } : null;
  }

  async update(id: string, updates: Partial<Job>): Promise<Job> {
    const j = this.jobs.get(id);
    if (!j) throw new Error('Job not found');
    const updated: Job = {
      ...j,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.jobs.set(id, updated);
    return { ...updated };
  }

  async findRunningJob(campaignId: string, type?: string): Promise<Job | null> {
    for (const j of this.jobs.values()) {
      if (j.campaignId === campaignId && j.status === 'running') {
        if (!type || j.type === type) {
          return { ...j };
        }
      }
    }
    return null;
  }

  async listRunningJobs(campaignId: string): Promise<Job[]> {
    const res: Job[] = [];
    for (const j of this.jobs.values()) {
      if (j.campaignId === campaignId && j.status === 'running') {
        res.push({ ...j });
      }
    }
    return res;
  }
}

export class InMemoryUserRepository {
  private users = new Map<string, User>();

  async upsert(user: User): Promise<User> {
    this.users.set(user.uid, { ...user });
    return { ...user };
  }

  async getById(uid: string): Promise<User | null> {
    return this.users.get(uid) || null;
  }
}
