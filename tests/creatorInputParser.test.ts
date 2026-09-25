import { describe, it, expect } from 'vitest';
import { parseCreatorInput } from '../shared/creatorInputParser';

describe('Creator Input Parser (Comprehensive Test Suite)', () => {
  // Case 1: Standard Channel ID
  it('1. parses direct 24-character YouTube Channel ID starting with UC', () => {
    const res = parseCreatorInput('UCX6OQ3DkcsbYNE6H8uQQuVA');
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.inputType).toBe('channelId');
      expect(res.value).toBe('UCX6OQ3DkcsbYNE6H8uQQuVA');
      expect(res.normalizedKey).toBe('channelid:UCX6OQ3DkcsbYNE6H8uQQuVA');
    }
  });

  // Case 2: Standard Handle with @
  it('2. parses standard handle with @ prefix', () => {
    const res = parseCreatorInput('@mkbhd');
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.inputType).toBe('handle');
      expect(res.value).toBe('@mkbhd');
      expect(res.normalizedKey).toBe('handle:@mkbhd');
    }
  });

  // Case 3: Case-insensitive normalization for handle
  it('3. normalizes handles case-insensitively for duplicate detection', () => {
    const res1 = parseCreatorInput('@MKBHD');
    const res2 = parseCreatorInput('@mkbhd');
    expect(res1.valid && res2.valid).toBe(true);
    if (res1.valid && res2.valid) {
      expect(res1.normalizedKey).toBe(res2.normalizedKey);
      expect(res1.normalizedKey).toBe('handle:@mkbhd');
    }
  });

  // Case 4: Handle without @
  it('4. parses bare handle without @ prefix', () => {
    const res = parseCreatorInput('veritasium');
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.inputType).toBe('handle');
      expect(res.value).toBe('@veritasium');
      expect(res.normalizedKey).toBe('handle:@veritasium');
    }
  });

  // Case 5: Full HTTPS URL with @handle
  it('5. parses full HTTPS YouTube @handle URL', () => {
    const res = parseCreatorInput('https://www.youtube.com/@mkbhd');
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.inputType).toBe('url');
      expect(res.value).toBe('@mkbhd');
      expect(res.normalizedKey).toBe('handle:@mkbhd');
    }
  });

  // Case 6: URL with subpath like /videos
  it('6. handles subpaths such as /videos in creator URLs', () => {
    const res = parseCreatorInput('https://youtube.com/@mkbhd/videos');
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.inputType).toBe('url');
      expect(res.value).toBe('@mkbhd');
      expect(res.normalizedKey).toBe('handle:@mkbhd');
    }
  });

  // Case 7: URL with query parameters
  it('7. strips query strings such as ?si=... or ?sub_confirmation=1', () => {
    const res = parseCreatorInput('https://www.youtube.com/@LinusTechTips?si=abcdef123&feature=shared');
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.inputType).toBe('url');
      expect(res.value).toBe('@LinusTechTips');
      expect(res.normalizedKey).toBe('handle:@linustechtips');
    }
  });

  // Case 8: Channel ID in URL
  it('8. extracts channel ID from /channel/UC... URLs', () => {
    const res = parseCreatorInput('https://www.youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA');
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.inputType).toBe('url');
      expect(res.value).toBe('UCX6OQ3DkcsbYNE6H8uQQuVA');
      expect(res.normalizedKey).toBe('channelid:UCX6OQ3DkcsbYNE6H8uQQuVA');
    }
  });

  // Case 9: Custom channel URL (/c/name)
  it('9. extracts custom channel names from /c/... URLs', () => {
    const res = parseCreatorInput('https://www.youtube.com/c/MarquesBrownlee');
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.inputType).toBe('url');
      expect(res.value).toBe('MarquesBrownlee');
      expect(res.normalizedKey).toBe('c:marquesbrownlee');
    }
  });

  // Case 10: Legacy user URL (/user/name)
  it('10. extracts legacy usernames from /user/... URLs', () => {
    const res = parseCreatorInput('https://youtube.com/user/marquesbrownlee');
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.inputType).toBe('url');
      expect(res.value).toBe('marquesbrownlee');
      expect(res.normalizedKey).toBe('user:marquesbrownlee');
    }
  });

  // Case 11: Mobile URL (m.youtube.com)
  it('11. handles mobile m.youtube.com URLs', () => {
    const res = parseCreatorInput('https://m.youtube.com/@mkbhd');
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.inputType).toBe('url');
      expect(res.value).toBe('@mkbhd');
      expect(res.normalizedKey).toBe('handle:@mkbhd');
    }
  });

  // Case 12: URL without protocol (youtube.com/@...)
  it('12. handles URLs without http/https protocol prefix', () => {
    const res = parseCreatorInput('youtube.com/@veritasium');
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.inputType).toBe('url');
      expect(res.value).toBe('@veritasium');
      expect(res.normalizedKey).toBe('handle:@veritasium');
    }
  });

  // Case 13: URL with trailing slash
  it('13. handles URLs with trailing slashes correctly', () => {
    const res = parseCreatorInput('https://www.youtube.com/@mkbhd/');
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.inputType).toBe('url');
      expect(res.value).toBe('@mkbhd');
      expect(res.normalizedKey).toBe('handle:@mkbhd');
    }
  });

  // Case 14: Non-YouTube URL rejection
  it('14. rejects non-YouTube URLs', () => {
    const res = parseCreatorInput('https://vimeo.com/channels/staffpicks');
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.reason).toContain('Only YouTube URLs');
    }
  });

  // Case 15: YouTube video page rejection (/watch)
  it('15. rejects YouTube watch video pages instead of channels', () => {
    const res = parseCreatorInput('https://youtube.com/watch?v=dQw4w9WgXcQ');
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.reason).toContain('watch');
    }
  });

  // Case 16: Empty and whitespace strings
  it('16. rejects empty or whitespace-only inputs', () => {
    const res1 = parseCreatorInput('');
    expect(res1.valid).toBe(false);
    const res2 = parseCreatorInput('   \n  ');
    expect(res2.valid).toBe(false);
  });

  // Case 17: Disallowed characters in handle
  it('17. rejects invalid handles with illegal characters', () => {
    const res = parseCreatorInput('@illegal!handle#name');
    expect(res.valid).toBe(false);
  });
});
