import { describe, it, expect } from 'vitest';
import { ScoringWeightsSchema, CpmAssumptionsSchema, CampaignSettingsSchema, Campaign } from '../shared/types';
import { getCampaignProgress } from '../shared/progress';
import { getSampleBrief } from '../shared/sampleBrief';

describe('Scoring Weights & CPM Validation', () => {
  it('validates weights that sum exactly to 100%', () => {
    const valid = ScoringWeightsSchema.safeParse({
      brandFit: 40,
      sentimentFit: 30,
      authenticityFit: 30,
    });
    expect(valid.success).toBe(true);
  });

  it('rejects weights that sum to less or more than 100%', () => {
    const less = ScoringWeightsSchema.safeParse({
      brandFit: 30,
      sentimentFit: 30,
      authenticityFit: 30,
    });
    expect(less.success).toBe(false);

    const more = ScoringWeightsSchema.safeParse({
      brandFit: 50,
      sentimentFit: 40,
      authenticityFit: 30,
    });
    expect(more.success).toBe(false);
  });

  it('validates CPM assumptions where low <= high and both > 0', () => {
    expect(CpmAssumptionsSchema.safeParse({ cpmLow: 25, cpmHigh: 45 }).success).toBe(true);
    expect(CpmAssumptionsSchema.safeParse({ cpmLow: 30, cpmHigh: 30 }).success).toBe(true);

    // low > high
    expect(CpmAssumptionsSchema.safeParse({ cpmLow: 50, cpmHigh: 20 }).success).toBe(false);
    // <= 0
    expect(CpmAssumptionsSchema.safeParse({ cpmLow: 0, cpmHigh: 20 }).success).toBe(false);
    expect(CpmAssumptionsSchema.safeParse({ cpmLow: -5, cpmHigh: 20 }).success).toBe(false);
  });

  it('validates campaign settings schema with defaults', () => {
    const parsed = CampaignSettingsSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.scoringWeights.brandFit).toBe(40);
      expect(parsed.data.searchBudgetShare).toBe(20);
    }
  });
});

describe('Unified Campaign Progress Logic (getCampaignProgress)', () => {
  const baseCampaign: Campaign = {
    id: 'camp_progress_test',
    ownerId: 'user_1',
    ownerEmail: 'user1@brand.com',
    memberEmails: [],
    name: 'Outin Launch 2026',
    status: 'draft',
    brief: null,
    settings: null,
    guidelineCounters: { brand: 0, baseline: 7 },
    guidelineIndexStale: false,
    approvedLineup: [],
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  };

  it('when brief is incomplete: brief is available, guidelines is locked with prerequisite link', () => {
    const progress = getCampaignProgress(baseCampaign, { activeBrandRulesCount: 0, creatorsCount: 0 });

    const briefStep = progress.steps.find((s) => s.key === 'brief')!;
    expect(briefStep.state).toBe('available');

    const guidelinesStep = progress.steps.find((s) => s.key === 'guidelines')!;
    expect(guidelinesStep.state).toBe('locked');
    expect(guidelinesStep.prerequisite?.path).toBe(`/campaigns/${baseCampaign.id}/brief`);

    const creatorsStep = progress.steps.find((s) => s.key === 'creators')!;
    expect(creatorsStep.state).toBe('locked');

    expect(progress.completedStepsCount).toBe(0);
    expect(progress.nextStep.key).toBe('brief');
  });

  it('when brief is completed: brief is complete, guidelines is available, creators is locked', () => {
    const campWithBrief: Campaign = {
      ...baseCampaign,
      brief: getSampleBrief(),
    };

    const progress = getCampaignProgress(campWithBrief, { activeBrandRulesCount: 0, creatorsCount: 0 });

    const briefStep = progress.steps.find((s) => s.key === 'brief')!;
    expect(briefStep.state).toBe('complete');

    const guidelinesStep = progress.steps.find((s) => s.key === 'guidelines')!;
    expect(guidelinesStep.state).toBe('available');

    const creatorsStep = progress.steps.find((s) => s.key === 'creators')!;
    expect(creatorsStep.state).toBe('locked');
    expect(creatorsStep.prerequisite?.path).toBe(`/campaigns/${baseCampaign.id}/guidelines`);

    expect(progress.nextStep.key).toBe('guidelines');
  });

  it('when at least 1 active brand rule exists: guidelines is complete, creators is available', () => {
    const campWithBrief: Campaign = {
      ...baseCampaign,
      brief: getSampleBrief(),
    };

    const progress = getCampaignProgress(campWithBrief, { activeBrandRulesCount: 2, creatorsCount: 0 });

    const guidelinesStep = progress.steps.find((s) => s.key === 'guidelines')!;
    expect(guidelinesStep.state).toBe('complete');

    const creatorsStep = progress.steps.find((s) => s.key === 'creators')!;
    expect(creatorsStep.state).toBe('available');

    expect(progress.nextStep.key).toBe('creators');
  });

  it('when creators exist: creators is complete, premortem is available', () => {
    const campWithBrief: Campaign = {
      ...baseCampaign,
      brief: getSampleBrief(),
    };

    const progress = getCampaignProgress(campWithBrief, { activeBrandRulesCount: 2, creatorsCount: 5 });

    const creatorsStep = progress.steps.find((s) => s.key === 'creators')!;
    expect(creatorsStep.state).toBe('complete');

    const premortemStep = progress.steps.find((s) => s.key === 'premortem')!;
    expect(premortemStep.state).toBe('available');

    expect(progress.completedStepsCount).toBe(3);
    expect(progress.nextStep.key).toBe('premortem');
  });
});
