import { Campaign } from './types';

export type StepState = 'complete' | 'available' | 'locked';

export interface StepPrerequisite {
  name: string;
  path: string;
}

export interface StepProgress {
  key: string;
  name: string;
  phase: number;
  state: StepState;
  reason: string;
  prerequisite: StepPrerequisite | null;
}

export interface SubcollectionCounts {
  activeBrandRulesCount?: number;
  creatorsCount?: number;
  premortemRunsCount?: number;
  briefsCount?: number;
  submissionsCount?: number;
  searchPackCount?: number;
  liveTrackingCount?: number;
}

export interface CampaignProgressSummary {
  steps: StepProgress[];
  overallPercent: number;
  completedStepsCount: number;
  totalStepsCount: number;
  nextStep: StepProgress;
}

/**
 * Pure function that computes each step's state (complete | available | locked,
 * plus a human-readable reason and prerequisite link) from campaign data.
 * Used identically across Stepper, Overview, Locked panels, and Next navigation.
 */
export function getCampaignProgress(
  campaign: Campaign,
  counts: SubcollectionCounts = {}
): CampaignProgressSummary {
  const cId = campaign.id;

  // 1. Brief step completion check
  const isBriefComplete = Boolean(
    campaign.brief &&
      campaign.brief.brandName &&
      campaign.brief.productName &&
      campaign.brief.landingPageUrl &&
      Array.isArray(campaign.brief.approvedFacts) &&
      campaign.brief.approvedFacts.length >= 1
  );

  // 2. Guidelines step completion check
  const activeBrandRules = counts.activeBrandRulesCount ?? 0;
  const isGuidelinesComplete = activeBrandRules >= 1;

  // 3. Creators step completion check
  const creatorsCount = counts.creatorsCount ?? (campaign.approvedLineup?.length || 0);
  const isCreatorsComplete = creatorsCount >= 1;

  // 4. Pre-Mortem step
  const premortemCount = counts.premortemRunsCount ?? 0;
  const isPremortemComplete = premortemCount >= 1;

  // 5. Creator Briefs step
  const briefsCount = counts.briefsCount ?? 0;
  const isBriefsComplete = briefsCount >= 1;

  // 6. Compliance step
  const submissionsCount = counts.submissionsCount ?? 0;
  const isComplianceComplete = submissionsCount >= 1;

  // 7. Search Capture step
  const searchPackCount = counts.searchPackCount ?? 0;
  const isSearchCaptureComplete = searchPackCount >= 1;

  // 8. Live step
  const liveCount = counts.liveTrackingCount ?? 0;
  const isLiveComplete = liveCount >= 1;

  const steps: StepProgress[] = [
    {
      key: 'overview',
      name: 'Overview',
      phase: 1,
      state: isBriefComplete ? 'complete' : 'available',
      reason: isBriefComplete ? 'Campaign workspace initialized' : 'Ready to configure campaign',
      prerequisite: null,
    },
    {
      key: 'brief',
      name: '1. Brief',
      phase: 2,
      state: isBriefComplete ? 'complete' : 'available',
      reason: isBriefComplete ? 'Brand brief and approved claims saved' : 'Define campaign objectives and facts',
      prerequisite: null,
    },
    {
      key: 'guidelines',
      name: '2. Guidelines',
      phase: 2,
      state: isGuidelinesComplete ? 'complete' : isBriefComplete ? 'available' : 'locked',
      reason: isGuidelinesComplete
        ? `${activeBrandRules} active brand safety rule${activeBrandRules === 1 ? '' : 's'}`
        : isBriefComplete
        ? 'Establish brand safety and disclosure rules'
        : 'Complete the Brand Brief first to establish approved product facts.',
      prerequisite: isBriefComplete
        ? null
        : { name: '1. Brief', path: `/campaigns/${cId}/brief` },
    },
    {
      key: 'creators',
      name: '3. Creators',
      phase: 3,
      state: isCreatorsComplete ? 'complete' : isGuidelinesComplete ? 'available' : 'locked',
      reason: isCreatorsComplete
        ? `${creatorsCount} candidate creator${creatorsCount === 1 ? '' : 's'} added`
        : isGuidelinesComplete
        ? 'Add YouTube channels or handles to evaluate'
        : 'Set up at least one active brand guideline first.',
      prerequisite: isGuidelinesComplete
        ? null
        : { name: '2. Guidelines', path: `/campaigns/${cId}/guidelines` },
    },
    {
      key: 'premortem',
      name: '4. Pre-Mortem',
      phase: 4,
      state: isPremortemComplete ? 'complete' : isCreatorsComplete ? 'available' : 'locked',
      reason: isPremortemComplete
        ? 'Risk simulation scenarios completed'
        : isCreatorsComplete
        ? 'Simulate prospective creator lineup risks'
        : 'Add candidate creators to simulate lineup risks.',
      prerequisite: isCreatorsComplete
        ? null
        : { name: '3. Creators', path: `/campaigns/${cId}/creators` },
    },
    {
      key: 'briefs',
      name: '5. Creator Briefs',
      phase: 5,
      state: isBriefsComplete ? 'complete' : isPremortemComplete ? 'available' : 'locked',
      reason: isBriefsComplete
        ? 'Personalized creator briefs generated'
        : isPremortemComplete
        ? 'Generate individualized briefs for approved lineup'
        : 'Run a Pre-Mortem risk simulation first.',
      prerequisite: isPremortemComplete
        ? null
        : { name: '4. Pre-Mortem', path: `/campaigns/${cId}/premortem` },
    },
    {
      key: 'compliance',
      name: '6. Compliance',
      phase: 6,
      state: isComplianceComplete ? 'complete' : isBriefsComplete ? 'available' : 'locked',
      reason: isComplianceComplete
        ? 'Video drafts audited against safety rubrics'
        : isBriefsComplete
        ? 'Review creator draft videos and disclosures'
        : 'Generate creator briefs before auditing video submissions.',
      prerequisite: isBriefsComplete
        ? null
        : { name: '5. Creator Briefs', path: `/campaigns/${cId}/briefs` },
    },
    {
      key: 'search-capture',
      name: '7. Search Capture',
      phase: 7,
      state: isSearchCaptureComplete ? 'complete' : isComplianceComplete ? 'available' : 'locked',
      reason: isSearchCaptureComplete
        ? 'Google AI Max demand pack ready'
        : isComplianceComplete
        ? 'Prepare search keywords and copy to intercept creator demand'
        : 'Complete compliance reviews before building Google AI Max search capture.',
      prerequisite: isComplianceComplete
        ? null
        : { name: '6. Compliance', path: `/campaigns/${cId}/compliance` },
    },
    {
      key: 'live',
      name: '8. Live Pulse',
      phase: 8,
      state: isLiveComplete ? 'complete' : isSearchCaptureComplete ? 'available' : 'locked',
      reason: isLiveComplete
        ? 'Live video tracking active'
        : isSearchCaptureComplete
        ? 'Monitor views, engagement velocity, and sentiment alerts'
        : 'Prepare search capture before launching live video tracking.',
      prerequisite: isSearchCaptureComplete
        ? null
        : { name: '7. Search Capture', path: `/campaigns/${cId}/search-capture` },
    },
    {
      key: 'report',
      name: 'Campaign Report',
      phase: 8,
      state: campaign.status === 'completed' || campaign.status === 'archived' ? 'complete' : isBriefComplete ? 'available' : 'locked',
      reason: 'Holistic performance report & post-mortem learnings',
      prerequisite: isBriefComplete ? null : { name: '1. Brief', path: `/campaigns/${cId}/brief` },
    },
    {
      key: 'settings',
      name: 'Settings',
      phase: 1,
      state: 'available',
      reason: 'Manage scoring weights, CPM, and team access',
      prerequisite: null,
    },
  ];

  // Core workflow milestone steps (brief, guidelines, creators, premortem, briefs, compliance, search-capture, live)
  const coreSteps = steps.filter((s) => s.phase >= 2);
  const completedStepsCount = coreSteps.filter((s) => s.state === 'complete').length;
  const totalStepsCount = coreSteps.length;
  const overallPercent = Math.round((completedStepsCount / totalStepsCount) * 100);

  // Next step is the first non-complete step in the core workflow
  const nextStep = coreSteps.find((s) => s.state !== 'complete') || steps[0];

  return {
    steps,
    overallPercent,
    completedStepsCount,
    totalStepsCount,
    nextStep,
  };
}
