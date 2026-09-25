import { Router, Request, Response, NextFunction } from 'express';
import {
  CreateCampaignRequestSchema,
  UpdateCampaignRequestSchema,
  DeleteCampaignRequestSchema,
  ListCampaignsQuerySchema,
  CampaignExportSchema,
  isValidStatusTransition,
  CampaignBriefSchema,
  UpdateBriefRequestSchema,
  PatchBriefRequestSchema,
  CampaignSettingsSchema,
  UpdateCampaignSettingsRequestSchema,
  UpdateCampaignMembersRequestSchema,
  CreateGuidelineRequestSchema,
  UpdateGuidelineRequestSchema,
  ReorderGuidelinesRequestSchema,
  ImportGuidelinesTextRequestSchema,
  ConfirmImportGuidelinesRequestSchema,
  CreateCreatorRequestSchema,
  BulkCreateCreatorsRequestSchema,
  UpdateCreatorRequestSchema,
  Guideline,
} from '../../shared/types';
import { splitGuidelineText } from '../../shared/guidelineSplitter';
import { getRepositories } from '../repositories';
import { CampaignEngine } from '../engines/campaigns/CampaignEngine';
import { AppError } from '../errors/AppError';

function validateDraftLaunchDate(launchDateStr: string | undefined, status: string) {
  if (status === 'draft' && launchDateStr) {
    const launchDate = new Date(launchDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const launchStart = new Date(launchDate);
    launchStart.setHours(0, 0, 0, 0);
    if (launchStart.getTime() < today.getTime()) {
      throw AppError.validation('Launch date must not be in the past while the campaign is a draft');
    }
  }
}

export const campaignRouter = Router();

// ----------------------------------------------------
// GET /api/v1/campaigns
// ----------------------------------------------------
campaignRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const query = ListCampaignsQuerySchema.parse(req.query);
      const repos = getRepositories();

      const result = await repos.campaigns.list({
        filters: {
          status: query.status,
          search: query.search,
          userEmail: user.email,
          ownerId: user.uid,
          isTrash: false,
        },
        sortField: query.sort,
        sortOrder: query.order,
        cursor: query.cursor,
        limit: query.limit,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ----------------------------------------------------
// GET /api/v1/campaigns/trash
// ----------------------------------------------------
campaignRouter.get(
  '/trash',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const repos = getRepositories();

      const result = await repos.campaigns.list({
        filters: {
          ownerId: user.uid,
          isTrash: true,
        },
        sortField: 'updatedAt',
        sortOrder: 'desc',
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ----------------------------------------------------
// POST /api/v1/campaigns
// ----------------------------------------------------
campaignRouter.post(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const body = CreateCampaignRequestSchema.parse(req.body);
      const repos = getRepositories();

      const campaign = await repos.campaigns.create({
        name: body.name,
        ownerId: user.uid,
        ownerEmail: user.email,
        memberEmails: [],
        status: 'draft',
        brief: null,
        settings: null,
        approvedLineup: [],
        deletedAt: null,
      });

      // Seed baseline rules L-1 through L-7 for every new campaign
      try {
        await repos.guidelines.seedBaselineRules(campaign.id);
      } catch (seedErr) {
        console.warn('[Campaigns] Baseline seeding warning:', seedErr);
      }

      await CampaignEngine.logActivity(
        campaign.id,
        user,
        'CREATE_CAMPAIGN',
        'campaign',
        campaign.id,
        `Created campaign "${campaign.name}"`
      );

      res.status(201).json(campaign);
    } catch (err) {
      next(err);
    }
  }
);

// ----------------------------------------------------
// POST /api/v1/campaigns/import
// ----------------------------------------------------
campaignRouter.post(
  '/import',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const exportData = CampaignExportSchema.parse(req.body);
      const campaign = await CampaignEngine.importCampaign(exportData, user);
      res.status(201).json(campaign);
    } catch (err) {
      next(err);
    }
  }
);

// ----------------------------------------------------
// GET /api/v1/campaigns/:id
// ----------------------------------------------------
campaignRouter.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const repos = getRepositories();
      const campaign = await repos.campaigns.getById(req.params.id);

      if (!campaign || campaign.deletedAt) {
        throw AppError.notFound('Campaign not found');
      }

      CampaignEngine.authorizeAccess(campaign, user);
      res.json(campaign);
    } catch (err) {
      next(err);
    }
  }
);

// ----------------------------------------------------
// PATCH /api/v1/campaigns/:id
// ----------------------------------------------------
campaignRouter.patch(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const body = UpdateCampaignRequestSchema.parse(req.body);
      const repos = getRepositories();
      const campaign = await repos.campaigns.getById(req.params.id);

      if (!campaign || campaign.deletedAt) {
        throw AppError.notFound('Campaign not found');
      }

      CampaignEngine.authorizeAccess(campaign, user);

      // Status transition validation
      if (body.status && body.status !== campaign.status) {
        if (!isValidStatusTransition(campaign.status, body.status)) {
          throw AppError.validation(
            `Invalid status transition from "${campaign.status}" to "${body.status}". Allowed: draft→active, active→completed, any→archived, archived→draft.`
          );
        }
      }

      // Member updates can only be made by owner
      if (body.memberEmails && campaign.ownerId !== user.uid) {
        throw AppError.forbidden('Only the owner can update campaign membership');
      }

      const updates: any = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.status !== undefined) updates.status = body.status;
      if (body.memberEmails !== undefined) updates.memberEmails = body.memberEmails;

      const updated = await repos.campaigns.update(campaign.id, updates, body.version);

      await CampaignEngine.logActivity(
        campaign.id,
        user,
        'UPDATE_CAMPAIGN',
        'campaign',
        campaign.id,
        `Updated campaign properties: ${Object.keys(updates).join(', ')}`
      );

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// ----------------------------------------------------
// DELETE /api/v1/campaigns/:id (Soft Delete)
// ----------------------------------------------------
campaignRouter.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const body = DeleteCampaignRequestSchema.parse(req.body);
      const repos = getRepositories();
      const campaign = await repos.campaigns.getById(req.params.id);

      if (!campaign || campaign.deletedAt) {
        throw AppError.notFound('Campaign not found');
      }

      CampaignEngine.authorizeOwner(campaign, user);
      const deleted = await repos.campaigns.softDelete(campaign.id, body.version);

      await CampaignEngine.logActivity(
        campaign.id,
        user,
        'TRASH_CAMPAIGN',
        'campaign',
        campaign.id,
        `Moved campaign to trash`
      );

      res.json({ success: true, campaign: deleted });
    } catch (err) {
      next(err);
    }
  }
);

// ----------------------------------------------------
// POST /api/v1/campaigns/:id/restore
// ----------------------------------------------------
campaignRouter.post(
  '/:id/restore',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const repos = getRepositories();
      const campaign = await repos.campaigns.getById(req.params.id);

      if (!campaign || !campaign.deletedAt) {
        throw AppError.notFound('Campaign not found in trash');
      }

      CampaignEngine.authorizeOwner(campaign, user);
      const restored = await repos.campaigns.restore(campaign.id);

      await CampaignEngine.logActivity(
        campaign.id,
        user,
        'RESTORE_CAMPAIGN',
        'campaign',
        campaign.id,
        `Restored campaign from trash`
      );

      res.json(restored);
    } catch (err) {
      next(err);
    }
  }
);

// ----------------------------------------------------
// DELETE /api/v1/campaigns/:id/permanent
// ----------------------------------------------------
campaignRouter.delete(
  '/:id/permanent',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const repos = getRepositories();
      const campaign = await repos.campaigns.getById(req.params.id);

      if (!campaign || !campaign.deletedAt) {
        throw AppError.notFound('Campaign is not in trash');
      }

      CampaignEngine.authorizeOwner(campaign, user);

      // Clean up subcollections
      await repos.activity.deleteAll(campaign.id);
      await repos.campaigns.hardDelete(campaign.id);

      res.json({ success: true, message: 'Permanently deleted campaign and associated subcollections' });
    } catch (err) {
      next(err);
    }
  }
);

// ----------------------------------------------------
// POST /api/v1/campaigns/:id/duplicate
// ----------------------------------------------------
campaignRouter.post(
  '/:id/duplicate',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const repos = getRepositories();
      const campaign = await repos.campaigns.getById(req.params.id);

      if (!campaign || campaign.deletedAt) {
        throw AppError.notFound('Campaign not found');
      }

      CampaignEngine.authorizeAccess(campaign, user);
      const duplicated = await CampaignEngine.duplicate(campaign, user);

      res.status(201).json(duplicated);
    } catch (err) {
      next(err);
    }
  }
);

// ----------------------------------------------------
// GET /api/v1/campaigns/:id/export
// ----------------------------------------------------
campaignRouter.get(
  '/:id/export',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const repos = getRepositories();
      const campaign = await repos.campaigns.getById(req.params.id);

      if (!campaign || campaign.deletedAt) {
        throw AppError.notFound('Campaign not found');
      }

      CampaignEngine.authorizeAccess(campaign, user);
      const exportJson = await CampaignEngine.exportCampaign(campaign);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${campaign.name.replace(/\s+/g, '_')}_export.json"`);
      res.json(exportJson);
    } catch (err) {
      next(err);
    }
  }
);

// ----------------------------------------------------
// GET /api/v1/campaigns/:id/activity
// ----------------------------------------------------
campaignRouter.get(
  '/:id/activity',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const repos = getRepositories();
      const campaign = await repos.campaigns.getById(req.params.id);

      if (!campaign || campaign.deletedAt) {
        throw AppError.notFound('Campaign not found');
      }

      CampaignEngine.authorizeAccess(campaign, user);
      const activities = await repos.activity.list(campaign.id, 50);

      res.json({ items: activities });
    } catch (err) {
      next(err);
    }
  }
);

// ====================================================
// Phase 2: A. CAMPAIGN BRIEF ENDPOINTS
// ====================================================

// ----------------------------------------------------
// GET /api/v1/campaigns/:id/brief
// ----------------------------------------------------
campaignRouter.get(
  '/:id/brief',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const repos = getRepositories();
      const campaign = await repos.campaigns.getById(req.params.id);

      if (!campaign || campaign.deletedAt) {
        throw AppError.notFound('Campaign not found');
      }

      CampaignEngine.authorizeAccess(campaign, user);

      res.json({
        brief: campaign.brief,
        version: campaign.version,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ----------------------------------------------------
// PUT /api/v1/campaigns/:id/brief (Full Replace)
// ----------------------------------------------------
campaignRouter.put(
  '/:id/brief',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const body = UpdateBriefRequestSchema.parse(req.body);
      const repos = getRepositories();
      const campaign = await repos.campaigns.getById(req.params.id);

      if (!campaign || campaign.deletedAt) {
        throw AppError.notFound('Campaign not found');
      }

      CampaignEngine.authorizeAccess(campaign, user);
      validateDraftLaunchDate(body.brief.launchDate, campaign.status);

      const updated = await repos.campaigns.update(
        campaign.id,
        { brief: body.brief },
        body.version
      );

      await CampaignEngine.logActivity(
        campaign.id,
        user,
        'UPDATE_BRIEF',
        'brief',
        campaign.id,
        `Updated campaign brief for ${body.brief.brandName} (${body.brief.productName})`
      );

      res.json({
        brief: updated.brief,
        version: updated.version,
        campaign: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ----------------------------------------------------
// PATCH /api/v1/campaigns/:id/brief (Partial Update)
// ----------------------------------------------------
campaignRouter.patch(
  '/:id/brief',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const body = PatchBriefRequestSchema.parse(req.body);
      const repos = getRepositories();
      const campaign = await repos.campaigns.getById(req.params.id);

      if (!campaign || campaign.deletedAt) {
        throw AppError.notFound('Campaign not found');
      }

      CampaignEngine.authorizeAccess(campaign, user);

      if (body.brief.launchDate) {
        validateDraftLaunchDate(body.brief.launchDate, campaign.status);
      }

      const mergedBrief = {
        ...(campaign.brief || {}),
        ...body.brief,
      } as any;

      const updated = await repos.campaigns.update(
        campaign.id,
        { brief: mergedBrief },
        body.version
      );

      await CampaignEngine.logActivity(
        campaign.id,
        user,
        'PATCH_BRIEF',
        'brief',
        campaign.id,
        `Partially updated brief fields: ${Object.keys(body.brief).join(', ')}`
      );

      res.json({
        brief: updated.brief,
        version: updated.version,
        campaign: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ====================================================
// Phase 2: B. BRAND GUIDELINES ENDPOINTS
// ====================================================

// ----------------------------------------------------
// GET /api/v1/campaigns/:id/guidelines
// ----------------------------------------------------
campaignRouter.get(
  '/:id/guidelines',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const repos = getRepositories();
      const campaign = await repos.campaigns.getById(req.params.id);

      if (!campaign || campaign.deletedAt) {
        throw AppError.notFound('Campaign not found');
      }

      CampaignEngine.authorizeAccess(campaign, user);
      const items = await repos.guidelines.list(campaign.id);

      res.json({
        items,
        count: items.length,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ----------------------------------------------------
// POST /api/v1/campaigns/:id/guidelines
// ----------------------------------------------------
campaignRouter.post(
  '/:id/guidelines',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const body = CreateGuidelineRequestSchema.parse(req.body);
      const repos = getRepositories();
      const campaign = await repos.campaigns.getById(req.params.id);

      if (!campaign || campaign.deletedAt) {
        throw AppError.notFound('Campaign not found');
      }

      CampaignEngine.authorizeAccess(campaign, user);

      const guideline = await repos.guidelines.create(campaign.id, {
        title: body.title,
        text: body.text,
        type: 'brand',
      });

      // Mark guideline index as stale
      try {
        await repos.campaigns.update(campaign.id, { guidelineIndexStale: true }, campaign.version);
      } catch {
        // Concurrency retry not blocking
      }

      await CampaignEngine.logActivity(
        campaign.id,
        user,
        'CREATE_GUIDELINE',
        'guideline',
        guideline.id,
        `Created brand guideline "${guideline.code}: ${guideline.title}"`
      );

      res.status(201).json(guideline);
    } catch (err) {
      next(err);
    }
  }
);

// ----------------------------------------------------
// GET /api/v1/campaigns/:id/guidelines/:guidelineId
// ----------------------------------------------------
campaignRouter.get(
  '/:id/guidelines/:guidelineId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const repos = getRepositories();
      const campaign = await repos.campaigns.getById(req.params.id);

      if (!campaign || campaign.deletedAt) {
        throw AppError.notFound('Campaign not found');
      }

      CampaignEngine.authorizeAccess(campaign, user);
      const guideline = await repos.guidelines.getById(campaign.id, req.params.guidelineId);

      if (!guideline) {
        throw AppError.notFound('Guideline not found');
      }

      res.json(guideline);
    } catch (err) {
      next(err);
    }
  }
);

// ----------------------------------------------------
// PATCH /api/v1/campaigns/:id/guidelines/:guidelineId
// ----------------------------------------------------
campaignRouter.patch(
  '/:id/guidelines/:guidelineId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const body = UpdateGuidelineRequestSchema.parse(req.body);
      const repos = getRepositories();
      const campaign = await repos.campaigns.getById(req.params.id);

      if (!campaign || campaign.deletedAt) {
        throw AppError.notFound('Campaign not found');
      }

      CampaignEngine.authorizeAccess(campaign, user);

      const updated = await repos.guidelines.update(
        campaign.id,
        req.params.guidelineId,
        body,
        body.version
      );

      // Mark guideline index as stale
      try {
        await repos.campaigns.update(campaign.id, { guidelineIndexStale: true }, campaign.version);
      } catch {
        // Concurrency retry not blocking
      }

      await CampaignEngine.logActivity(
        campaign.id,
        user,
        'UPDATE_GUIDELINE',
        'guideline',
        updated.id,
        `Updated guideline ${updated.code} (${updated.title})`
      );

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// ----------------------------------------------------
// DELETE /api/v1/campaigns/:id/guidelines/:guidelineId
// ----------------------------------------------------
campaignRouter.delete(
  '/:id/guidelines/:guidelineId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const repos = getRepositories();
      const campaign = await repos.campaigns.getById(req.params.id);

      if (!campaign || campaign.deletedAt) {
        throw AppError.notFound('Campaign not found');
      }

      CampaignEngine.authorizeAccess(campaign, user);

      await repos.guidelines.delete(campaign.id, req.params.guidelineId);

      // Mark guideline index as stale
      try {
        await repos.campaigns.update(campaign.id, { guidelineIndexStale: true }, campaign.version);
      } catch {
        // Concurrency retry not blocking
      }

      await CampaignEngine.logActivity(
        campaign.id,
        user,
        'DELETE_GUIDELINE',
        'guideline',
        req.params.guidelineId,
        `Deleted guideline ${req.params.guidelineId}`
      );

      res.json({ success: true, id: req.params.guidelineId });
    } catch (err) {
      next(err);
    }
  }
);

// ----------------------------------------------------
// POST /api/v1/campaigns/:id/guidelines/reorder
// ----------------------------------------------------
campaignRouter.post(
  '/:id/guidelines/reorder',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const body = ReorderGuidelinesRequestSchema.parse(req.body);
      const repos = getRepositories();
      const campaign = await repos.campaigns.getById(req.params.id);

      if (!campaign || campaign.deletedAt) {
        throw AppError.notFound('Campaign not found');
      }

      CampaignEngine.authorizeAccess(campaign, user);

      const items = await repos.guidelines.reorder(campaign.id, body.orderedIds);

      // Mark guideline index as stale
      try {
        await repos.campaigns.update(campaign.id, { guidelineIndexStale: true }, campaign.version);
      } catch {
        // Concurrency retry not blocking
      }

      await CampaignEngine.logActivity(
        campaign.id,
        user,
        'REORDER_GUIDELINES',
        'guidelines',
        campaign.id,
        `Reordered ${body.orderedIds.length} guidelines`
      );

      res.json({ items });
    } catch (err) {
      next(err);
    }
  }
);

// ----------------------------------------------------
// POST /api/v1/campaigns/:id/guidelines/import-text (Preview)
// ----------------------------------------------------
campaignRouter.post(
  '/:id/guidelines/import-text',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const body = ImportGuidelinesTextRequestSchema.parse(req.body);
      const repos = getRepositories();
      const campaign = await repos.campaigns.getById(req.params.id);

      if (!campaign || campaign.deletedAt) {
        throw AppError.notFound('Campaign not found');
      }

      CampaignEngine.authorizeAccess(campaign, user);

      const parsedRules = splitGuidelineText(body.text);

      res.json({
        rules: parsedRules,
        count: parsedRules.length,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ----------------------------------------------------
// POST /api/v1/campaigns/:id/guidelines/import-text/confirm (Save Previewed Rules)
// ----------------------------------------------------
campaignRouter.post(
  '/:id/guidelines/import-text/confirm',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const body = ConfirmImportGuidelinesRequestSchema.parse(req.body);
      const repos = getRepositories();
      const campaign = await repos.campaigns.getById(req.params.id);

      if (!campaign || campaign.deletedAt) {
        throw AppError.notFound('Campaign not found');
      }

      CampaignEngine.authorizeAccess(campaign, user);

      const addedRules: Guideline[] = [];
      for (const rule of body.rules) {
        const created = await repos.guidelines.create(campaign.id, {
          title: rule.title,
          text: rule.text,
          type: 'brand',
        });
        addedRules.push(created);
      }

      // Mark guideline index as stale
      try {
        await repos.campaigns.update(campaign.id, { guidelineIndexStale: true }, campaign.version);
      } catch {
        // Concurrency retry not blocking
      }

      await CampaignEngine.logActivity(
        campaign.id,
        user,
        'IMPORT_GUIDELINES',
        'guidelines',
        campaign.id,
        `Imported ${addedRules.length} brand guidelines from text`
      );

      res.status(201).json({
        items: addedRules,
        addedCount: addedRules.length,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ====================================================
// Phase 2: C. CANDIDATE CREATORS ENDPOINTS
// ====================================================

// ----------------------------------------------------
// GET /api/v1/campaigns/:id/creators
// ----------------------------------------------------
campaignRouter.get(
  '/:id/creators',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const repos = getRepositories();
      const campaign = await repos.campaigns.getById(req.params.id);

      if (!campaign || campaign.deletedAt) {
        throw AppError.notFound('Campaign not found');
      }

      CampaignEngine.authorizeAccess(campaign, user);

      const status = req.query.status as string | undefined;
      const selectedQuery = req.query.selected as string | undefined;
      const selected =
        selectedQuery === 'true' ? true : selectedQuery === 'false' ? false : undefined;
      const sort = req.query.sort as string | undefined;

      const creators = await repos.creators.list(campaign.id, {
        status,
        selected,
        sort,
      });

      res.json({
        items: creators,
        count: creators.length,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ----------------------------------------------------
// POST /api/v1/campaigns/:id/creators
// ----------------------------------------------------
campaignRouter.post(
  '/:id/creators',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const body = CreateCreatorRequestSchema.parse(req.body);
      const repos = getRepositories();
      const campaign = await repos.campaigns.getById(req.params.id);

      if (!campaign || campaign.deletedAt) {
        throw AppError.notFound('Campaign not found');
      }

      CampaignEngine.authorizeAccess(campaign, user);

      const creator = await repos.creators.create(campaign.id, body.input);

      await CampaignEngine.logActivity(
        campaign.id,
        user,
        'ADD_CREATOR',
        'creator',
        creator.id,
        `Added creator "${creator.input}" (${creator.inputType})`
      );

      res.status(201).json(creator);
    } catch (err) {
      next(err);
    }
  }
);

// ----------------------------------------------------
// POST /api/v1/campaigns/:id/creators/bulk
// ----------------------------------------------------
campaignRouter.post(
  '/:id/creators/bulk',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const body = BulkCreateCreatorsRequestSchema.parse(req.body);
      const repos = getRepositories();
      const campaign = await repos.campaigns.getById(req.params.id);

      if (!campaign || campaign.deletedAt) {
        throw AppError.notFound('Campaign not found');
      }

      CampaignEngine.authorizeAccess(campaign, user);

      const result = await repos.creators.bulkCreate(campaign.id, body.inputs);

      await CampaignEngine.logActivity(
        campaign.id,
        user,
        'BULK_ADD_CREATORS',
        'creators',
        campaign.id,
        `Bulk added ${result.addedCount} creators (${result.duplicateCount} duplicates, ${result.invalidCount} invalid)`
      );

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ----------------------------------------------------
// GET /api/v1/campaigns/:id/creators/:creatorId
// ----------------------------------------------------
campaignRouter.get(
  '/:id/creators/:creatorId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const repos = getRepositories();
      const campaign = await repos.campaigns.getById(req.params.id);

      if (!campaign || campaign.deletedAt) {
        throw AppError.notFound('Campaign not found');
      }

      CampaignEngine.authorizeAccess(campaign, user);

      const creator = await repos.creators.getById(campaign.id, req.params.creatorId);
      if (!creator) {
        throw AppError.notFound('Creator not found');
      }

      res.json(creator);
    } catch (err) {
      next(err);
    }
  }
);

// ----------------------------------------------------
// PATCH /api/v1/campaigns/:id/creators/:creatorId
// ----------------------------------------------------
campaignRouter.patch(
  '/:id/creators/:creatorId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const body = UpdateCreatorRequestSchema.parse(req.body);
      const repos = getRepositories();
      const campaign = await repos.campaigns.getById(req.params.id);

      if (!campaign || campaign.deletedAt) {
        throw AppError.notFound('Campaign not found');
      }

      CampaignEngine.authorizeAccess(campaign, user);

      const updated = await repos.creators.update(
        campaign.id,
        req.params.creatorId,
        body,
        body.version
      );

      await CampaignEngine.logActivity(
        campaign.id,
        user,
        'UPDATE_CREATOR',
        'creator',
        updated.id,
        `Updated details for creator "${updated.input}"`
      );

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// ----------------------------------------------------
// DELETE /api/v1/campaigns/:id/creators/:creatorId
// ----------------------------------------------------
campaignRouter.delete(
  '/:id/creators/:creatorId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const repos = getRepositories();
      const campaign = await repos.campaigns.getById(req.params.id);

      if (!campaign || campaign.deletedAt) {
        throw AppError.notFound('Campaign not found');
      }

      CampaignEngine.authorizeAccess(campaign, user);

      await repos.creators.delete(campaign.id, req.params.creatorId);

      await CampaignEngine.logActivity(
        campaign.id,
        user,
        'REMOVE_CREATOR',
        'creator',
        req.params.creatorId,
        `Removed creator ${req.params.creatorId} from campaign`
      );

      res.json({ success: true, id: req.params.creatorId });
    } catch (err) {
      next(err);
    }
  }
);

// ====================================================
// Phase 2: D. CAMPAIGN SETTINGS & MEMBERS ENDPOINTS
// ====================================================

// ----------------------------------------------------
// PATCH /api/v1/campaigns/:id/settings
// ----------------------------------------------------
campaignRouter.patch(
  '/:id/settings',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const body = UpdateCampaignSettingsRequestSchema.parse(req.body);
      const repos = getRepositories();
      const campaign = await repos.campaigns.getById(req.params.id);

      if (!campaign || campaign.deletedAt) {
        throw AppError.notFound('Campaign not found');
      }

      CampaignEngine.authorizeAccess(campaign, user);

      const updated = await repos.campaigns.update(
        campaign.id,
        { settings: body.settings },
        body.version
      );

      await CampaignEngine.logActivity(
        campaign.id,
        user,
        'UPDATE_SETTINGS',
        'settings',
        campaign.id,
        `Updated scoring weights, CPM assumptions, and search budget share`
      );

      res.json({
        settings: updated.settings,
        version: updated.version,
        campaign: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ----------------------------------------------------
// PATCH /api/v1/campaigns/:id/members (Owner Only)
// ----------------------------------------------------
campaignRouter.patch(
  '/:id/members',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const body = UpdateCampaignMembersRequestSchema.parse(req.body);
      const repos = getRepositories();
      const campaign = await repos.campaigns.getById(req.params.id);

      if (!campaign || campaign.deletedAt) {
        throw AppError.notFound('Campaign not found');
      }

      // Membership can only be edited by the campaign owner
      CampaignEngine.authorizeOwner(campaign, user);

      const updated = await repos.campaigns.update(
        campaign.id,
        { memberEmails: body.memberEmails },
        body.version
      );

      await CampaignEngine.logActivity(
        campaign.id,
        user,
        'UPDATE_MEMBERS',
        'members',
        campaign.id,
        `Updated campaign team membership (${body.memberEmails.length} members)`
      );

      res.json({
        memberEmails: updated.memberEmails,
        version: updated.version,
        campaign: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);
