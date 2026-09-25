import { describe, it, expect, beforeEach } from 'vitest';
import {
  CreateCampaignRequestSchema,
  UpdateCampaignRequestSchema,
  CampaignExportSchema,
  isValidStatusTransition,
  Campaign,
} from '../shared/types';
import { InMemoryCampaignRepository } from '../server/repositories/InMemoryCampaignRepository';
import { CampaignEngine } from '../server/engines/campaigns/CampaignEngine';
import { AppError } from '../server/errors/AppError';

describe('Campaign Zod Schemas', () => {
  it('validates creation requests correctly', () => {
    // Valid
    const valid = CreateCampaignRequestSchema.safeParse({ name: 'Summer Launch 2026' });
    expect(valid.success).toBe(true);

    // Too short
    const short = CreateCampaignRequestSchema.safeParse({ name: 'AB' });
    expect(short.success).toBe(false);

    // Too long (over 80 chars)
    const long = CreateCampaignRequestSchema.safeParse({ name: 'A'.repeat(81) });
    expect(long.success).toBe(false);
  });

  it('validates update requests requiring version', () => {
    // Missing version
    const invalid = UpdateCampaignRequestSchema.safeParse({ name: 'Updated Name' });
    expect(invalid.success).toBe(false);

    // With version
    const valid = UpdateCampaignRequestSchema.safeParse({ name: 'Updated Name', version: 1 });
    expect(valid.success).toBe(true);
  });

  it('validates campaign export/import structure', () => {
    const validExport = {
      schemaVersion: '1.0.0',
      campaign: {
        name: 'Demo Export',
        status: 'draft',
        memberEmails: ['team@brand.com'],
        brief: null,
        settings: null,
        approvedLineup: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      subcollections: {
        creators: [],
        guidelines: [],
        premortemRuns: [],
        briefs: [],
        submissions: [],
        searchPack: [],
        trackedVideos: [],
        activity: [],
      },
    };

    const parsed = CampaignExportSchema.safeParse(validExport);
    expect(parsed.success).toBe(true);
  });
});

describe('Campaign Status Transitions', () => {
  it('allows valid transitions according to workflow rules', () => {
    expect(isValidStatusTransition('draft', 'active')).toBe(true);
    expect(isValidStatusTransition('active', 'completed')).toBe(true);
    expect(isValidStatusTransition('active', 'archived')).toBe(true);
    expect(isValidStatusTransition('completed', 'archived')).toBe(true);
    expect(isValidStatusTransition('archived', 'draft')).toBe(true);
    // Identity is allowed
    expect(isValidStatusTransition('draft', 'draft')).toBe(true);
  });

  it('rejects disallowed transitions', () => {
    expect(isValidStatusTransition('draft', 'completed')).toBe(false);
    expect(isValidStatusTransition('completed', 'active')).toBe(false);
    expect(isValidStatusTransition('completed', 'draft')).toBe(false);
  });
});

describe('InMemoryCampaignRepository & Optimistic Concurrency', () => {
  let repo: InMemoryCampaignRepository;

  beforeEach(() => {
    repo = new InMemoryCampaignRepository();
  });

  it('creates and lists campaigns with version initialized to 1', async () => {
    const campaign = await repo.create({
      name: 'Test Campaign',
      ownerId: 'user-1',
      ownerEmail: 'user1@test.com',
      memberEmails: [],
      status: 'draft',
      brief: null,
      settings: null,
      approvedLineup: [],
      deletedAt: null,
    });

    expect(campaign.id).toBeDefined();
    expect(campaign.version).toBe(1);
    expect(campaign.status).toBe('draft');

    const list = await repo.list({ filters: { ownerId: 'user-1' } });
    expect(list.items.length).toBe(1);
  });

  it('increments version on update and throws 409 CONFLICT on version mismatch', async () => {
    const campaign = await repo.create({
      name: 'Initial Name',
      ownerId: 'user-1',
      ownerEmail: 'user1@test.com',
      memberEmails: [],
      status: 'draft',
      brief: null,
      settings: null,
      approvedLineup: [],
      deletedAt: null,
    });

    // Update with correct version
    const updated = await repo.update(campaign.id, { name: 'New Name' }, 1);
    expect(updated.version).toBe(2);
    expect(updated.name).toBe('New Name');

    // Attempt update with stale version 1
    await expect(repo.update(campaign.id, { name: 'Stale Attempt' }, 1)).rejects.toThrowError(
      AppError
    );
  });

  it('soft deletes with version increment and restores', async () => {
    const campaign = await repo.create({
      name: 'To Delete',
      ownerId: 'user-1',
      ownerEmail: 'user1@test.com',
      memberEmails: [],
      status: 'draft',
      brief: null,
      settings: null,
      approvedLineup: [],
      deletedAt: null,
    });

    const deleted = await repo.softDelete(campaign.id, 1);
    expect(deleted.deletedAt).not.toBeNull();
    expect(deleted.version).toBe(2);

    const activeList = await repo.list({ filters: { isTrash: false } });
    expect(activeList.items.find((c) => c.id === campaign.id)).toBeUndefined();

    const trashList = await repo.list({ filters: { isTrash: true } });
    expect(trashList.items.find((c) => c.id === campaign.id)).toBeDefined();

    const restored = await repo.restore(campaign.id);
    expect(restored.deletedAt).toBeNull();
    expect(restored.version).toBe(3);
  });
});

describe('CampaignEngine Authorization', () => {
  const dummyCampaign: Campaign = {
    id: 'camp-123',
    ownerId: 'owner-uid',
    ownerEmail: 'owner@brand.com',
    memberEmails: ['member@brand.com'],
    name: 'Authorized Campaign',
    status: 'draft',
    brief: null,
    settings: null,
    approvedLineup: [],
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  };

  it('authorizes owners and members for general access', () => {
    expect(() =>
      CampaignEngine.authorizeAccess(dummyCampaign, {
        uid: 'owner-uid',
        email: 'owner@brand.com',
        displayName: 'Owner',
      })
    ).not.toThrow();

    expect(() =>
      CampaignEngine.authorizeAccess(dummyCampaign, {
        uid: 'member-uid',
        email: 'member@brand.com',
        displayName: 'Member',
      })
    ).not.toThrow();
  });

  it('rejects strangers with 404 NOT_FOUND (never reveal campaign exists)', () => {
    try {
      CampaignEngine.authorizeAccess(dummyCampaign, {
        uid: 'stranger-uid',
        email: 'stranger@other.com',
        displayName: 'Stranger',
      });
      expect.fail('Should have thrown');
    } catch (e: any) {
      expect(e).toBeInstanceOf(AppError);
      expect(e.statusCode).toBe(404);
      expect(e.code).toBe('NOT_FOUND');
    }
  });

  it('enforces owner-only actions with 403 FORBIDDEN for members', () => {
    try {
      CampaignEngine.authorizeOwner(dummyCampaign, {
        uid: 'member-uid',
        email: 'member@brand.com',
        displayName: 'Member',
      });
      expect.fail('Should have thrown');
    } catch (e: any) {
      expect(e).toBeInstanceOf(AppError);
      expect(e.statusCode).toBe(403);
      expect(e.code).toBe('FORBIDDEN');
    }
  });
});
