import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app';
import { initRepositories, getRepositories } from '../server/repositories';
import { getSampleBrief } from '../shared/sampleBrief';

describe('Phase 2 API CRUD Endpoints Integration', () => {
  let app: any;
  const ownerEmail = 'owner@brand.com';
  const ownerToken = `Bearer demo-token-${ownerEmail}`;
  const memberEmail = 'member@brand.com';
  const memberToken = `Bearer demo-token-${memberEmail}`;
  const strangerEmail = 'stranger@external.com';
  const strangerToken = `Bearer demo-token-${strangerEmail}`;

  let campaignId: string;
  let campaignVersion = 1;

  beforeAll(async () => {
    process.env.DEMO_MODE = 'true';
    initRepositories(true);
    app = createApp();

    // Create a base campaign owned by ownerEmail
    const res = await request(app)
      .post('/api/v1/campaigns')
      .set('Authorization', ownerToken)
      .send({ name: 'Phase 2 Test Campaign' });

    expect(res.status).toBe(201);
    campaignId = res.body.id;
    campaignVersion = res.body.version;

    // Add memberEmail to campaign
    const memRes = await request(app)
      .patch(`/api/v1/campaigns/${campaignId}/members`)
      .set('Authorization', ownerToken)
      .send({ memberEmails: [memberEmail], version: campaignVersion });

    expect(memRes.status).toBe(200);
    campaignVersion = memRes.body.version;
  });

  // --------------------------------------------------
  // A. CAMPAIGN BRIEF API
  // --------------------------------------------------
  describe('Brief Endpoints', () => {
    it('GET /api/v1/campaigns/:id/brief returns current brief and version', async () => {
      const res = await request(app)
        .get(`/api/v1/campaigns/${campaignId}/brief`)
        .set('Authorization', ownerToken);

      expect(res.status).toBe(200);
      expect(res.body.brief).toBe(null);
      expect(res.body.version).toBe(campaignVersion);
    });

    it('PUT /api/v1/campaigns/:id/brief replaces brief with version check', async () => {
      const sample = getSampleBrief();
      const res = await request(app)
        .put(`/api/v1/campaigns/${campaignId}/brief`)
        .set('Authorization', ownerToken)
        .send({ brief: sample, version: campaignVersion });

      expect(res.status).toBe(200);
      expect(res.body.brief.brandName).toBe('Outin');
      expect(res.body.version).toBe(campaignVersion + 1);
      campaignVersion = res.body.version;
    });

    it('PUT /api/v1/campaigns/:id/brief returns 409 on version conflict', async () => {
      const sample = getSampleBrief();
      const res = await request(app)
        .put(`/api/v1/campaigns/${campaignId}/brief`)
        .set('Authorization', ownerToken)
        .send({ brief: sample, version: campaignVersion - 1 }); // Stale version

      expect(res.status).toBe(409);
    });

    it('PATCH /api/v1/campaigns/:id/brief partially updates brief', async () => {
      const res = await request(app)
        .patch(`/api/v1/campaigns/${campaignId}/brief`)
        .set('Authorization', memberToken) // Member can also update brief
        .send({
          brief: { customTone: 'Updated tone directive' },
          version: campaignVersion,
        });

      expect(res.status).toBe(200);
      expect(res.body.brief.customTone).toBe('Updated tone directive');
      expect(res.body.brief.brandName).toBe('Outin'); // Preserves previous fields
      campaignVersion = res.body.version;
    });

    it('rejects launchDate in the past while campaign is draft', async () => {
      const pastBrief = getSampleBrief();
      pastBrief.launchDate = '2020-01-01';

      const res = await request(app)
        .put(`/api/v1/campaigns/${campaignId}/brief`)
        .set('Authorization', ownerToken)
        .send({ brief: pastBrief, version: campaignVersion });

      expect(res.status).toBe(400);
    });
  });

  // --------------------------------------------------
  // B. BRAND GUIDELINES API
  // --------------------------------------------------
  describe('Guidelines Endpoints', () => {
    let brandRuleId: string;
    let brandRuleVersion = 1;

    it('GET /guidelines returns seeded baseline rules L-1 through L-7', async () => {
      const res = await request(app)
        .get(`/api/v1/campaigns/${campaignId}/guidelines`)
        .set('Authorization', ownerToken);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThanOrEqual(7);
      const codes = res.body.items.map((i: any) => i.code);
      expect(codes).toContain('L-1');
      expect(codes).toContain('L-7');
    });

    it('POST /guidelines creates a brand rule with G-1 code', async () => {
      const res = await request(app)
        .post(`/api/v1/campaigns/${campaignId}/guidelines`)
        .set('Authorization', ownerToken)
        .send({
          title: 'No Direct Sunlight Demonstrations',
          text: 'Device battery must not be exposed to direct midday desert sun over 45°C.',
        });

      expect(res.status).toBe(201);
      expect(res.body.code).toBe('G-1');
      expect(res.body.type).toBe('brand');
      brandRuleId = res.body.id;
      brandRuleVersion = res.body.version;
    });

    it('PATCH /guidelines/:id updates guideline and version', async () => {
      const res = await request(app)
        .patch(`/api/v1/campaigns/${campaignId}/guidelines/${brandRuleId}`)
        .set('Authorization', ownerToken)
        .send({
          title: 'Updated Title Rule',
          version: brandRuleVersion,
        });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated Title Rule');
      expect(res.body.version).toBe(brandRuleVersion + 1);
      brandRuleVersion = res.body.version;
    });

    it('DELETE /guidelines/:id deletes brand rule', async () => {
      const res = await request(app)
        .delete(`/api/v1/campaigns/${campaignId}/guidelines/${brandRuleId}`)
        .set('Authorization', ownerToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('DELETE /guidelines/:id rejects deleting baseline rules with 400', async () => {
      const listRes = await request(app)
        .get(`/api/v1/campaigns/${campaignId}/guidelines`)
        .set('Authorization', ownerToken);

      const baseline = listRes.body.items.find((i: any) => i.code === 'L-1');
      const res = await request(app)
        .delete(`/api/v1/campaigns/${campaignId}/guidelines/${baseline.id}`)
        .set('Authorization', ownerToken);

      expect(res.status).toBe(400);
    });

    it('POST /guidelines/import-text returns preview without saving', async () => {
      const sampleText = `
1. Audio clarity: Voiceover audio must be crisp with no background music louder than -14dB.
2. Caption alignment: Subtitles must not obscure lower-third disclosures.
      `;
      const res = await request(app)
        .post(`/api/v1/campaigns/${campaignId}/guidelines/import-text`)
        .set('Authorization', ownerToken)
        .send({ text: sampleText });

      expect(res.status).toBe(200);
      expect(res.body.rules.length).toBe(2);
      expect(res.body.rules[0].title).toBe('Audio clarity');
    });

    it('POST /guidelines/import-text/confirm saves parsed rules', async () => {
      const rules = [
        {
          title: 'Audio Clarity Rule',
          text: 'Voiceover audio must be crisp with no background music louder than -14dB.',
        },
      ];
      const res = await request(app)
        .post(`/api/v1/campaigns/${campaignId}/guidelines/import-text/confirm`)
        .set('Authorization', ownerToken)
        .send({ rules });

      expect(res.status).toBe(201);
      expect(res.body.addedCount).toBe(1);
      expect(res.body.items[0].type).toBe('brand');
    });
  });

  // --------------------------------------------------
  // C. CANDIDATE CREATORS API
  // --------------------------------------------------
  describe('Creators Endpoints', () => {
    let creatorId: string;
    let creatorVersion = 1;

    it('POST /creators adds a creator with parsed inputType', async () => {
      const res = await request(app)
        .post(`/api/v1/campaigns/${campaignId}/creators`)
        .set('Authorization', ownerToken)
        .send({ input: '@mkbhd' });

      expect(res.status).toBe(201);
      expect(res.body.inputType).toBe('handle');
      expect(res.body.status).toBe('pending');
      creatorId = res.body.id;
      creatorVersion = res.body.version;
    });

    it('POST /creators rejects duplicate creator', async () => {
      const res = await request(app)
        .post(`/api/v1/campaigns/${campaignId}/creators`)
        .set('Authorization', ownerToken)
        .send({ input: 'https://youtube.com/@MKBHD' }); // Duplicate handle

      expect(res.status).toBe(409);
    });

    it('POST /creators/bulk adds creators and flags duplicates / invalids', async () => {
      const inputs = [
        '@veritasium', // Valid new
        '@mkbhd', // Duplicate of existing
        'https://vimeo.com/invalid', // Invalid URL
        'UCX6OQ3DkcsbYNE6H8uQQuVA', // Valid channel ID
      ];

      const res = await request(app)
        .post(`/api/v1/campaigns/${campaignId}/creators/bulk`)
        .set('Authorization', ownerToken)
        .send({ inputs });

      expect(res.status).toBe(200);
      expect(res.body.addedCount).toBe(2);
      expect(res.body.duplicateCount).toBe(1);
      expect(res.body.invalidCount).toBe(1);
    });

    it('GET /creators returns list with filters', async () => {
      const res = await request(app)
        .get(`/api/v1/campaigns/${campaignId}/creators`)
        .set('Authorization', ownerToken);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThanOrEqual(3);
    });

    it('PATCH /creators/:id updates notes, tags, selected status', async () => {
      const res = await request(app)
        .patch(`/api/v1/campaigns/${campaignId}/creators/${creatorId}`)
        .set('Authorization', ownerToken)
        .send({
          notes: 'Great fit for coffee travel gear.',
          tags: ['tech', 'coffee'],
          selected: true,
          version: creatorVersion,
        });

      expect(res.status).toBe(200);
      expect(res.body.selected).toBe(true);
      expect(res.body.notes).toBe('Great fit for coffee travel gear.');
      expect(res.body.tags).toEqual(['tech', 'coffee']);
      creatorVersion = res.body.version;
    });

    it('DELETE /creators/:id removes creator', async () => {
      const res = await request(app)
        .delete(`/api/v1/campaigns/${campaignId}/creators/${creatorId}`)
        .set('Authorization', ownerToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // --------------------------------------------------
  // D. CAMPAIGN SETTINGS & MEMBERS API
  // --------------------------------------------------
  describe('Settings & Members Endpoints', () => {
    it('PATCH /settings updates scoring weights and CPM with version check', async () => {
      const res = await request(app)
        .patch(`/api/v1/campaigns/${campaignId}/settings`)
        .set('Authorization', ownerToken)
        .send({
          settings: {
            scoringWeights: { brandFit: 50, sentimentFit: 30, authenticityFit: 20 },
            cpmAssumptions: { cpmLow: 20, cpmHigh: 40 },
            searchBudgetShare: 25,
          },
          version: campaignVersion,
        });

      expect(res.status).toBe(200);
      expect(res.body.settings.scoringWeights.brandFit).toBe(50);
      expect(res.body.settings.searchBudgetShare).toBe(25);
      campaignVersion = res.body.version;
    });

    it('PATCH /members allows owner to update member emails', async () => {
      const res = await request(app)
        .patch(`/api/v1/campaigns/${campaignId}/members`)
        .set('Authorization', ownerToken)
        .send({
          memberEmails: [memberEmail, 'designer@brand.com'],
          version: campaignVersion,
        });

      expect(res.status).toBe(200);
      expect(res.body.memberEmails).toContain('designer@brand.com');
      campaignVersion = res.body.version;
    });

    it('PATCH /members returns 403 Forbidden when called by a non-owner member', async () => {
      const res = await request(app)
        .patch(`/api/v1/campaigns/${campaignId}/members`)
        .set('Authorization', memberToken)
        .send({
          memberEmails: ['hacker@brand.com'],
          version: campaignVersion,
        });

      expect(res.status).toBe(403);
    });
  });

  // --------------------------------------------------
  // E. PRIVACY & AUTHORIZATION: 404 FOR STRANGERS
  // --------------------------------------------------
  describe('Authorization: 404 Not Found for strangers', () => {
    it('returns 404 for strangers on GET /brief', async () => {
      const res = await request(app)
        .get(`/api/v1/campaigns/${campaignId}/brief`)
        .set('Authorization', strangerToken);

      expect(res.status).toBe(404);
    });

    it('returns 404 for strangers on GET /guidelines', async () => {
      const res = await request(app)
        .get(`/api/v1/campaigns/${campaignId}/guidelines`)
        .set('Authorization', strangerToken);

      expect(res.status).toBe(404);
    });

    it('returns 404 for strangers on GET /creators', async () => {
      const res = await request(app)
        .get(`/api/v1/campaigns/${campaignId}/creators`)
        .set('Authorization', strangerToken);

      expect(res.status).toBe(404);
    });
  });
});
