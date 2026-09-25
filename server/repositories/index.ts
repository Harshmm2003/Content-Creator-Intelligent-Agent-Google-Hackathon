import { Repository } from './Repository';
import { Campaign, Activity, Job } from '../../shared/types';
import { InMemoryCampaignRepository } from './InMemoryCampaignRepository';
import { InMemoryActivityRepository, InMemoryJobRepository, InMemoryUserRepository } from './InMemoryOtherRepositories';
import { FirestoreCampaignRepository, FirestoreActivityRepository } from './FirestoreRepository';
import {
  IGuidelineRepository,
  InMemoryGuidelineRepository,
  FirestoreGuidelineRepository,
} from './GuidelineRepository';
import {
  ICreatorRepository,
  InMemoryCreatorRepository,
  FirestoreCreatorRepository,
} from './CreatorRepository';

export interface RepositoryRegistry {
  campaigns: Repository<Campaign>;
  guidelines: IGuidelineRepository;
  creators: ICreatorRepository;
  activity: {
    create(campaignId: string, data: Omit<Activity, 'id' | 'campaignId'>): Promise<Activity>;
    list(campaignId: string, limit?: number): Promise<Activity[]>;
    deleteAll(campaignId: string): Promise<number>;
  };
  jobs: InMemoryJobRepository;
  users: InMemoryUserRepository;
  isDemo: boolean;
}

let registry: RepositoryRegistry | null = null;

export function initRepositories(demoMode = false): RepositoryRegistry {
  if (registry) return registry;

  const isDemo = demoMode || process.env.DEMO_MODE === 'true';

  if (isDemo) {
    console.log('[Repositories] Initializing IN-MEMORY repositories (Demo/Test Mode)');
    registry = {
      campaigns: new InMemoryCampaignRepository(),
      guidelines: new InMemoryGuidelineRepository(),
      creators: new InMemoryCreatorRepository(),
      activity: new InMemoryActivityRepository(),
      jobs: new InMemoryJobRepository(),
      users: new InMemoryUserRepository(),
      isDemo: true,
    };
  } else {
    console.log('[Repositories] Initializing FIRESTORE repositories');
    try {
      registry = {
        campaigns: new FirestoreCampaignRepository(),
        guidelines: new FirestoreGuidelineRepository(),
        creators: new FirestoreCreatorRepository(),
        activity: new FirestoreActivityRepository(),
        jobs: new InMemoryJobRepository(), // Fast in-process job tracker with persistence
        users: new InMemoryUserRepository(),
        isDemo: false,
      };
    } catch (e) {
      console.warn('[Repositories] Firestore initialization failed, falling back to InMemory:', e);
      registry = {
        campaigns: new InMemoryCampaignRepository(),
        guidelines: new InMemoryGuidelineRepository(),
        creators: new InMemoryCreatorRepository(),
        activity: new InMemoryActivityRepository(),
        jobs: new InMemoryJobRepository(),
        users: new InMemoryUserRepository(),
        isDemo: true,
      };
    }
  }

  return registry;
}

export function getRepositories(): RepositoryRegistry {
  if (!registry) {
    registry = initRepositories();
  }
  return registry;
}
