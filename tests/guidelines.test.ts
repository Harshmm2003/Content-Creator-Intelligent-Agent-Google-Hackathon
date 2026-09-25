import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryGuidelineRepository } from '../server/repositories/GuidelineRepository';
import { splitGuidelineText } from '../shared/guidelineSplitter';
import { BASELINE_GUIDELINES } from '../shared/baselineGuidelines';

describe('Guideline Code Assignment & Repository Rules', () => {
  let repo: InMemoryGuidelineRepository;
  const campaignId = 'camp_test_123';

  beforeEach(() => {
    repo = new InMemoryGuidelineRepository();
  });

  it('auto-seeds baseline rules L-1 through L-7', async () => {
    const list = await repo.list(campaignId);
    expect(list.length).toBe(7);
    expect(list.every((g) => g.type === 'baseline')).toBe(true);

    const codes = list.map((g) => g.code);
    expect(codes).toEqual(['L-1', 'L-2', 'L-3', 'L-4', 'L-5', 'L-6', 'L-7']);
  });

  it('assigns sequential G-1, G-2 codes to brand rules and never reuses deleted codes', async () => {
    const g1 = await repo.create(campaignId, {
      title: 'First Brand Safety Rule',
      text: 'Do not showcase competing portable espresso devices.',
    });
    expect(g1.code).toBe('G-1');

    const g2 = await repo.create(campaignId, {
      title: 'Second Brand Safety Rule',
      text: 'Must clearly state the battery life of 7,500mAh.',
    });
    expect(g2.code).toBe('G-2');

    // Delete G-1
    await repo.delete(campaignId, g1.id);

    // Create G-3
    const g3 = await repo.create(campaignId, {
      title: 'Third Brand Safety Rule',
      text: 'Temperature demonstration must show at least 92°C.',
    });
    // Must NOT reuse G-1; must assign G-3!
    expect(g3.code).toBe('G-3');
  });

  it('prohibits deleting baseline rules (allows deactivation only)', async () => {
    const list = await repo.list(campaignId);
    const baseline = list.find((g) => g.code === 'L-1')!;

    // Delete attempt should throw error
    await expect(repo.delete(campaignId, baseline.id)).rejects.toThrow();

    // Deactivation update should succeed
    const deactivated = await repo.update(
      campaignId,
      baseline.id,
      { active: false },
      baseline.version
    );
    expect(deactivated.active).toBe(false);
  });

  it('reorders guidelines according to orderedIds array', async () => {
    const list = await repo.list(campaignId);
    const reversedIds = list.map((g) => g.id).reverse();

    const reordered = await repo.reorder(campaignId, reversedIds);
    expect(reordered[0].id).toBe(reversedIds[0]);
    expect(reordered[0].order).toBe(1);
    expect(reordered[reordered.length - 1].order).toBe(reversedIds.length);
  });
});

describe('Guideline Text Splitter (splitGuidelineText)', () => {
  it('splits numbered lists into discrete guideline rules', () => {
    const text = `
1. Video Title Disclosure: Title must include #ad or (Sponsored) conspicuously.
2. Verbal Disclosure: State sponsorship within first 60 seconds of video.
3. No Medical Claims: Do not claim espresso cures chronic fatigue or depression.
    `;
    const rules = splitGuidelineText(text);
    expect(rules.length).toBe(3);
    expect(rules[0].title).toBe('Video Title Disclosure');
    expect(rules[0].text).toContain('#ad or (Sponsored)');
    expect(rules[1].title).toBe('Verbal Disclosure');
    expect(rules[2].title).toBe('No Medical Claims');
  });

  it('splits markdown headings (### Header) into rules', () => {
    const text = `
## Safe Driving Rules
Do not operate espresso maker while driving in a moving vehicle.

## Brewing Water Safety
Always use potable water; never brew with alcohol or combustible liquids.
    `;
    const rules = splitGuidelineText(text);
    expect(rules.length).toBe(2);
    expect(rules[0].title).toBe('Safe Driving Rules');
    expect(rules[1].title).toBe('Brewing Water Safety');
  });

  it('splits plain paragraphs when no explicit headings exist', () => {
    const text = `
Competitor non-disparagement: Creators must not insult or show broken competitor products in tests.

Battery demonstration: When demonstrating battery charging, show the official USB-C cable plugged in.
    `;
    const rules = splitGuidelineText(text);
    expect(rules.length).toBe(2);
    expect(rules[0].title).toContain('Competitor non-disparagement');
    expect(rules[1].title).toContain('Battery demonstration');
  });

  it('enforces maximum 300 words per rule by chunking longer texts', () => {
    const longBody = Array(650).fill('word').join(' ');
    const text = `### Massive Policy Document\n${longBody}`;
    const rules = splitGuidelineText(text);
    expect(rules.length).toBeGreaterThanOrEqual(3);
    for (const rule of rules) {
      const wordCount = rule.text.split(/\s+/).length;
      expect(wordCount).toBeLessThanOrEqual(305);
    }
  });

  it('returns empty array for empty or whitespace-only text', () => {
    expect(splitGuidelineText('')).toEqual([]);
    expect(splitGuidelineText('   \n  ')).toEqual([]);
  });
});
