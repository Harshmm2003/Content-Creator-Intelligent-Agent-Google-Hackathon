export interface BaselineGuidelineDefinition {
  code: string;
  type: 'baseline';
  title: string;
  text: string;
  order: number;
}

export const BASELINE_GUIDELINES: BaselineGuidelineDefinition[] = [
  {
    code: 'L-1',
    type: 'baseline',
    title: 'Clear and Conspicuous Sponsorship Disclosure',
    text: 'Sponsored content needs a clear and conspicuous disclosure (such as "#ad" or "Sponsored") that viewers cannot miss, not buried among many hashtags or only at the end.',
    order: 1,
  },
  {
    code: 'L-2',
    type: 'baseline',
    title: 'Verbal Sponsorship Disclosure',
    text: 'The video needs a verbal disclosure near the start of the sponsored segment.',
    order: 2,
  },
  {
    code: 'L-3',
    type: 'baseline',
    title: 'Honest Experience & Claim Substantiation',
    text: "No claims about results the creator hasn't experienced or that the approved product facts don't support.",
    order: 3,
  },
  {
    code: 'L-4',
    type: 'baseline',
    title: 'Strict Health, Financial & Safety Boundaries',
    text: 'No health, financial, or safety claims beyond the approved product facts.',
    order: 4,
  },
  {
    code: 'L-5',
    type: 'baseline',
    title: 'Non-Disparagement of Named Competitors',
    text: 'No disparaging named competitors.',
    order: 5,
  },
  {
    code: 'L-6',
    type: 'baseline',
    title: 'Child-Directed Content Safeguards',
    text: 'Content that appears directed at children needs extra review.',
    order: 6,
  },
  {
    code: 'L-7',
    type: 'baseline',
    title: 'YouTube Paid Promotion Platform Setting',
    text: "Reminder: enable YouTube's paid promotion setting on the video.",
    order: 7,
  },
];
