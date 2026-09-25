import { Campaign, CampaignExport, isValidStatusTransition } from '../../../shared/types';
import { AppError } from '../../errors/AppError';
import { getRepositories } from '../../repositories';
import { AuthenticatedUser } from '../../middleware/auth';

export class CampaignEngine {
  /**
   * Enforces campaign authorization.
   * If user is neither owner nor member, return 404 (never reveal campaign exists).
   */
  static authorizeAccess(campaign: Campaign, user: AuthenticatedUser): void {
    const isOwner = campaign.ownerId === user.uid;
    const isMember = campaign.memberEmails?.includes(user.email);
    if (!isOwner && !isMember) {
      throw AppError.notFound('Campaign not found');
    }
  }

  /**
   * Only owners may perform destructive actions or manage membership.
   */
  static authorizeOwner(campaign: Campaign, user: AuthenticatedUser): void {
    if (campaign.ownerId !== user.uid) {
      throw AppError.forbidden('Only the campaign owner can perform this action');
    }
  }

  static async logActivity(
    campaignId: string,
    user: AuthenticatedUser,
    action: string,
    entityType: string,
    entityId: string,
    summary: string
  ): Promise<void> {
    const repos = getRepositories();
    await repos.activity.create(campaignId, {
      actorEmail: user.email,
      action,
      entityType,
      entityId,
      summary,
      at: new Date().toISOString(),
    });
  }

  static async duplicate(campaign: Campaign, user: AuthenticatedUser): Promise<Campaign> {
    const repos = getRepositories();
    const newName = `Copy of ${campaign.name}`;
    const duplicated = await repos.campaigns.create({
      name: newName.slice(0, 80),
      ownerId: user.uid,
      ownerEmail: user.email,
      memberEmails: [],
      status: 'draft',
      brief: campaign.brief,
      settings: campaign.settings,
      approvedLineup: [],
      deletedAt: null,
    });

    await this.logActivity(
      duplicated.id,
      user,
      'DUPLICATE_CAMPAIGN',
      'campaign',
      duplicated.id,
      `Duplicated from campaign "${campaign.name}"`
    );

    return duplicated;
  }

  static async exportCampaign(campaign: Campaign): Promise<CampaignExport> {
    const repos = getRepositories();
    const activityEntries = await repos.activity.list(campaign.id, 100);
    const guidelines = await repos.guidelines.list(campaign.id);
    const creators = await repos.creators.list(campaign.id);

    return {
      schemaVersion: '1.0.0',
      campaign: {
        name: campaign.name,
        status: campaign.status,
        memberEmails: campaign.memberEmails,
        brief: campaign.brief,
        settings: campaign.settings,
        guidelineCounters: campaign.guidelineCounters || { brand: 0, baseline: 7 },
        guidelineIndexStale: campaign.guidelineIndexStale || false,
        approvedLineup: campaign.approvedLineup,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
        version: campaign.version,
      },
      subcollections: {
        creators: creators.map((c) => ({ ...c })) as any,
        guidelines: guidelines.map((g) => ({ ...g })) as any,
        premortemRuns: [],
        briefs: [],
        submissions: [],
        searchPack: [],
        trackedVideos: [],
        activity: activityEntries.map((a) => ({
          actorEmail: a.actorEmail,
          action: a.action,
          entityType: a.entityType,
          entityId: a.entityId,
          summary: a.summary,
          at: a.at,
        })),
      },
    };
  }

  static async importCampaign(data: CampaignExport, user: AuthenticatedUser): Promise<Campaign> {
    const repos = getRepositories();
    const importedName = data.campaign.name ? `Imported - ${data.campaign.name}`.slice(0, 80) : 'Imported Campaign';

    const campaign = await repos.campaigns.create({
      name: importedName,
      ownerId: user.uid,
      ownerEmail: user.email,
      memberEmails: data.campaign.memberEmails || [],
      status: 'draft',
      brief: data.campaign.brief || null,
      settings: data.campaign.settings || null,
      guidelineCounters: (data.campaign as any).guidelineCounters || { brand: 0, baseline: 7 },
      guidelineIndexStale: (data.campaign as any).guidelineIndexStale || false,
      approvedLineup: data.campaign.approvedLineup || [],
      deletedAt: null,
    });

    // Import guidelines
    if (data.subcollections.guidelines && data.subcollections.guidelines.length > 0) {
      for (const g of data.subcollections.guidelines) {
        if (g.title && g.text) {
          await repos.guidelines.create(campaign.id, {
            title: String(g.title),
            text: String(g.text),
            type: (g.type as any) === 'baseline' ? 'baseline' : 'brand',
          });
        }
      }
    } else {
      await repos.guidelines.seedBaselineRules(campaign.id);
    }

    // Import creators
    if (data.subcollections.creators && data.subcollections.creators.length > 0) {
      const inputs = data.subcollections.creators.map((c) => String(c.input || '')).filter(Boolean);
      if (inputs.length > 0) {
        await repos.creators.bulkCreate(campaign.id, inputs);
      }
    }

    await this.logActivity(
      campaign.id,
      user,
      'IMPORT_CAMPAIGN',
      'campaign',
      campaign.id,
      `Imported campaign from schema ${data.schemaVersion}`
    );

    return campaign;
  }
}
