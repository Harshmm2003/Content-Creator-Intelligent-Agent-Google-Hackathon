import { describe, it, expect } from 'vitest';
import { CampaignBriefSchema, UpdateBriefRequestSchema, PatchBriefRequestSchema } from '../shared/types';
import { getSampleBrief } from '../shared/sampleBrief';

describe('Campaign Brief Schema & Validation', () => {
  it('validates a valid sample brief successfully', () => {
    const sample = getSampleBrief();
    const parsed = CampaignBriefSchema.safeParse(sample);
    expect(parsed.success).toBe(true);
  });

  it('enforces required brandName and productName (1-80 chars)', () => {
    const sample = getSampleBrief();
    // Empty brandName
    expect(CampaignBriefSchema.safeParse({ ...sample, brandName: '' }).success).toBe(false);
    // Over 80 chars
    expect(CampaignBriefSchema.safeParse({ ...sample, brandName: 'A'.repeat(81) }).success).toBe(false);

    // Empty productName
    expect(CampaignBriefSchema.safeParse({ ...sample, productName: '' }).success).toBe(false);
    expect(CampaignBriefSchema.safeParse({ ...sample, productName: 'B'.repeat(81) }).success).toBe(false);
  });

  it('enforces valid secure https:// landing page URL', () => {
    const sample = getSampleBrief();
    // Valid https
    expect(CampaignBriefSchema.safeParse({ ...sample, landingPageUrl: 'https://mysite.com/product' }).success).toBe(true);
    // Insecure http
    expect(CampaignBriefSchema.safeParse({ ...sample, landingPageUrl: 'http://mysite.com/product' }).success).toBe(false);
    // Invalid URL string
    expect(CampaignBriefSchema.safeParse({ ...sample, landingPageUrl: 'not-a-url' }).success).toBe(false);
  });

  it('enforces approvedFacts array limits (1-20 items, 5-300 chars each)', () => {
    const sample = getSampleBrief();
    // 0 items
    expect(CampaignBriefSchema.safeParse({ ...sample, approvedFacts: [] }).success).toBe(false);

    // Item too short (< 5 chars)
    expect(CampaignBriefSchema.safeParse({ ...sample, approvedFacts: ['Cool'] }).success).toBe(false);

    // Item too long (> 300 chars)
    expect(CampaignBriefSchema.safeParse({ ...sample, approvedFacts: ['X'.repeat(301)] }).success).toBe(false);

    // Over 20 items
    const manyFacts = Array(21).fill('Valid fact claim statement here.');
    expect(CampaignBriefSchema.safeParse({ ...sample, approvedFacts: manyFacts }).success).toBe(false);

    // Valid 5 facts
    expect(CampaignBriefSchema.safeParse({ ...sample, approvedFacts: ['Valid claim number 1', 'Valid claim number 2'] }).success).toBe(true);
  });

  it('enforces targetAudience length (20-500 chars)', () => {
    const sample = getSampleBrief();
    // Too short (< 20 chars)
    expect(CampaignBriefSchema.safeParse({ ...sample, targetAudience: 'Coffee drinkers' }).success).toBe(false);

    // Valid
    expect(CampaignBriefSchema.safeParse({ ...sample, targetAudience: 'Coffee lovers and campers looking for portable espresso gear.' }).success).toBe(true);

    // Over 500 chars
    expect(CampaignBriefSchema.safeParse({ ...sample, targetAudience: 'A'.repeat(501) }).success).toBe(false);
  });

  it('enforces budgetUsd (> 0 and <= 10,000,000)', () => {
    const sample = getSampleBrief();
    expect(CampaignBriefSchema.safeParse({ ...sample, budgetUsd: 0 }).success).toBe(false);
    expect(CampaignBriefSchema.safeParse({ ...sample, budgetUsd: -500 }).success).toBe(false);
    expect(CampaignBriefSchema.safeParse({ ...sample, budgetUsd: 10_000_001 }).success).toBe(false);
    expect(CampaignBriefSchema.safeParse({ ...sample, budgetUsd: 25000 }).success).toBe(true);
  });

  it('enforces goal must be awareness, consideration, or conversions', () => {
    const sample = getSampleBrief();
    expect(CampaignBriefSchema.safeParse({ ...sample, goal: 'awareness' }).success).toBe(true);
    expect(CampaignBriefSchema.safeParse({ ...sample, goal: 'consideration' }).success).toBe(true);
    expect(CampaignBriefSchema.safeParse({ ...sample, goal: 'conversions' }).success).toBe(true);
    expect(CampaignBriefSchema.safeParse({ ...sample, goal: 'virality' as any }).success).toBe(false);
  });

  it('requires version in UpdateBriefRequestSchema and PatchBriefRequestSchema', () => {
    const sample = getSampleBrief();
    // Missing version
    expect(UpdateBriefRequestSchema.safeParse({ brief: sample }).success).toBe(false);
    // With version
    expect(UpdateBriefRequestSchema.safeParse({ brief: sample, version: 1 }).success).toBe(true);

    // Patch request
    expect(PatchBriefRequestSchema.safeParse({ brief: { brandName: 'Updated' } }).success).toBe(false);
    expect(PatchBriefRequestSchema.safeParse({ brief: { brandName: 'Updated' }, version: 2 }).success).toBe(true);
  });
});
