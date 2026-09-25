export type CreatorInputType = 'channelId' | 'handle' | 'url';

export interface ParseCreatorSuccess {
  valid: true;
  original: string;
  inputType: CreatorInputType;
  value: string;
  normalizedKey: string;
}

export interface ParseCreatorFailure {
  valid: false;
  original: string;
  reason: string;
}

export type ParseCreatorResult = ParseCreatorSuccess | ParseCreatorFailure;

const CHANNEL_ID_REGEX = /^UC[a-zA-Z0-9_-]{22}$/;
const HANDLE_REGEX = /^@?[a-zA-Z0-9_.-]{3,30}$/;

/**
 * Pure function to parse, validate, and normalize creator inputs:
 * - Channel IDs: start with "UC", 24 chars
 * - @handles: e.g. @mkbhd or mkbhd
 * - URLs: youtube.com/@handle, youtube.com/channel/UC..., youtube.com/c/name, youtube.com/user/name
 * Handles http, https, www, m., query params, extra path segments (/videos), etc.
 */
export function parseCreatorInput(rawInput: string): ParseCreatorResult {
  const original = rawInput;
  const trimmed = rawInput.trim();

  if (!trimmed) {
    return {
      valid: false,
      original,
      reason: 'Input is empty',
    };
  }

  // 1. Direct Channel ID
  if (CHANNEL_ID_REGEX.test(trimmed)) {
    return {
      valid: true,
      original,
      inputType: 'channelId',
      value: trimmed,
      normalizedKey: `channelid:${trimmed}`,
    };
  }

  // 2. Direct @Handle
  if (trimmed.startsWith('@')) {
    const handleName = trimmed.slice(1);
    if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(handleName)) {
      return {
        valid: false,
        original,
        reason: 'Invalid YouTube handle format (must be 3-30 characters)',
      };
    }
    return {
      valid: true,
      original,
      inputType: 'handle',
      value: `@${handleName}`,
      normalizedKey: `handle:@${handleName.toLowerCase()}`,
    };
  }

  // 3. YouTube URL or domain-like string
  const looksLikeUrl =
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('www.') ||
    trimmed.startsWith('m.') ||
    trimmed.startsWith('youtube.com') ||
    trimmed.startsWith('youtu.be');

  if (looksLikeUrl) {
    let urlString = trimmed;
    if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
      urlString = `https://${urlString}`;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(urlString);
    } catch {
      return {
        valid: false,
        original,
        reason: 'Invalid URL format',
      };
    }

    const host = parsedUrl.hostname.toLowerCase();
    const isYouTube =
      host === 'youtube.com' ||
      host === 'www.youtube.com' ||
      host === 'm.youtube.com' ||
      host.endsWith('.youtube.com') ||
      host === 'youtu.be';

    if (!isYouTube) {
      return {
        valid: false,
        original,
        reason: 'Only YouTube URLs are supported',
      };
    }

    // Split pathname into clean segments
    const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);

    if (pathSegments.length === 0) {
      return {
        valid: false,
        original,
        reason: 'URL missing YouTube creator path or handle',
      };
    }

    const firstSegment = pathSegments[0];

    // Case: /@handle or /@handle/videos
    if (firstSegment.startsWith('@')) {
      const handle = firstSegment.slice(1);
      if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(handle)) {
        return {
          valid: false,
          original,
          reason: 'Invalid YouTube handle format in URL',
        };
      }
      return {
        valid: true,
        original,
        inputType: 'url',
        value: `@${handle}`,
        normalizedKey: `handle:@${handle.toLowerCase()}`,
      };
    }

    // Case: /channel/UC...
    if (firstSegment === 'channel') {
      const channelId = pathSegments[1];
      if (!channelId || !CHANNEL_ID_REGEX.test(channelId)) {
        return {
          valid: false,
          original,
          reason: 'Invalid channel ID format in URL (must start with UC and be 24 characters)',
        };
      }
      return {
        valid: true,
        original,
        inputType: 'url',
        value: channelId,
        normalizedKey: `channelid:${channelId}`,
      };
    }

    // Case: /c/CustomName
    if (firstSegment === 'c') {
      const customName = pathSegments[1];
      if (!customName || !/^[a-zA-Z0-9_.-]{2,50}$/.test(customName)) {
        return {
          valid: false,
          original,
          reason: 'Invalid custom channel name in URL',
        };
      }
      return {
        valid: true,
        original,
        inputType: 'url',
        value: customName,
        normalizedKey: `c:${customName.toLowerCase()}`,
      };
    }

    // Case: /user/LegacyUsername
    if (firstSegment === 'user') {
      const username = pathSegments[1];
      if (!username || !/^[a-zA-Z0-9_.-]{2,50}$/.test(username)) {
        return {
          valid: false,
          original,
          reason: 'Invalid legacy username in URL',
        };
      }
      return {
        valid: true,
        original,
        inputType: 'url',
        value: username,
        normalizedKey: `user:${username.toLowerCase()}`,
      };
    }

    // Reject non-channel pages like /watch, /playlist, /results, /feed
    const nonChannelPaths = ['watch', 'playlist', 'results', 'feed', 'gaming', 'premium'];
    if (nonChannelPaths.includes(firstSegment)) {
      return {
        valid: false,
        original,
        reason: `URL points to a YouTube ${firstSegment} page, not a creator channel`,
      };
    }

    // Case: youtube.com/handleName (without @)
    if (/^[a-zA-Z0-9_.-]{3,30}$/.test(firstSegment)) {
      return {
        valid: true,
        original,
        inputType: 'url',
        value: `@${firstSegment}`,
        normalizedKey: `handle:@${firstSegment.toLowerCase()}`,
      };
    }

    return {
      valid: false,
      original,
      reason: 'Could not extract a valid YouTube channel or handle from URL',
    };
  }

  // 4. Fallback: bare username if it matches standard handle format
  if (/^[a-zA-Z0-9_.-]{3,30}$/.test(trimmed)) {
    return {
      valid: true,
      original,
      inputType: 'handle',
      value: `@${trimmed}`,
      normalizedKey: `handle:@${trimmed.toLowerCase()}`,
    };
  }

  return {
    valid: false,
    original,
    reason: 'Unsupported format. Provide a YouTube channel ID (UC...), @handle, or channel URL',
  };
}
