import { CampaignBrief } from './types';

/**
 * Generates realistic sample brief data for a portable espresso maker.
 * Dynamically computes launch date 30 days in the future so it is never in the past.
 */
export function getSampleBrief(): CampaignBrief {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const launchDateStr = futureDate.toISOString().split('T')[0];

  return {
    brandName: 'Outin',
    productName: 'Outin Nano Portable Espresso Machine',
    productCategory: 'Coffee Appliances & Outdoor Travel Gear',
    landingPageUrl: 'https://outin.com/products/outin-nano-portable-espresso-machine',
    approvedFacts: [
      'Heats cold water to 92°C in just 3 minutes with rapid thermal technology.',
      'Delivers up to 20 bars of electric pressure to extract rich crema with commercial quality.',
      '2-in-1 versatile brewing: fully compatible with ground coffee and standard Nespresso original capsules.',
      '7,500mAh USB-C rechargeable battery delivers 5 cold-water extractions or 100+ brews with pre-heated water.',
      'Compact, lightweight design weighing only 670g with IPX6 outdoor water resistance.',
    ],
    competitors: ['Wacaco Nanopresso', 'AeroPress Go', 'Flair GO', 'Staresso Portable'],
    bannedTerms: [
      'cheap plastic',
      'cures fatigue',
      'miracle energy maker',
      'replaces high-end $3000 commercial cafe machines',
    ],
    nicheKeywords: [
      'travel espresso',
      'camp coffee',
      'portable espresso',
      'coffee gear',
      'espresso crema',
      'vanlife setup',
    ],
    targetAudience:
      'Outdoor adventurers, campers, remote tech professionals, and specialty coffee lovers aged 24-45 who value authentic espresso rituals on trails, in camper vans, or while traveling.',
    geography: 'US',
    tones: ['educational', 'authentic', 'energetic'],
    customTone: 'Rugged yet refined, focusing on genuine workflow demonstration',
    budgetUsd: 45000,
    goal: 'consideration',
    launchDate: launchDateStr,
    requiredDisclosures: {
      descriptionText: '#ad',
      verbalText: 'This video is sponsored by Outin.',
    },
  };
}
