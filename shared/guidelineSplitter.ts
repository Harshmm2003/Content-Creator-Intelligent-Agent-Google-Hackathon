import { CONFIG } from './config';

export interface SplitGuidelineItem {
  title: string;
  text: string;
}

/**
 * Splits pasted guidelines text into discrete rules by headings, numbered list markers,
 * and paragraphs. Enforces a maximum of 300 words per rule.
 * Deterministic pure function.
 */
export function splitGuidelineText(rawText: string): SplitGuidelineItem[] {
  if (!rawText || !rawText.trim()) {
    return [];
  }

  const lines = rawText.split('\n');
  const sections: { title: string; lines: string[] }[] = [];
  let currentTitle = '';
  let currentLines: string[] = [];

  const headingRegex = /^(?:#{1,6}\s+|(?:\d+[\.\)]\s+)|(?:(?:Rule|Guideline|Standard)\s+\d+[:\.\-]\s*))(.+)$/i;

  for (const line of lines) {
    const trimmedLine = line.trim();
    const headingMatch = trimmedLine.match(headingRegex);

    if (headingMatch) {
      // Flush previous section if it has non-empty content or title
      const hasContent = currentLines.some((l) => l.trim().length > 0);
      if (hasContent || currentTitle.trim().length > 0) {
        sections.push({
          title: currentTitle,
          lines: currentLines,
        });
      }
      currentTitle = headingMatch[1].trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  // Flush final section
  const hasRemainingContent = currentLines.some((l) => l.trim().length > 0);
  if (hasRemainingContent || currentTitle.trim().length > 0) {
    sections.push({
      title: currentTitle,
      lines: currentLines,
    });
  }

  // If no headings were found at all, split by blank lines / paragraphs
  let candidateBlocks: { title: string; body: string }[] = [];
  if (sections.length === 1 && !sections[0].title) {
    const paragraphs = rawText.split(/\n\s*\n+/).filter((p) => p.trim().length > 0);
    candidateBlocks = paragraphs.map((p, idx) => {
      const pTrimmed = p.trim();
      const firstLineBreak = pTrimmed.indexOf('\n');
      let title = '';
      let body = pTrimmed;

      if (firstLineBreak > 0 && firstLineBreak < 80) {
        title = pTrimmed.slice(0, firstLineBreak).replace(/^[#\-*\s]+/, '').trim();
        body = pTrimmed.slice(firstLineBreak + 1).trim();
      }

      if (!title || title.length < 3) {
        // Use first sentence or up to 60 chars
        const firstSentence = pTrimmed.split(/[.?!]\s+/)[0];
        title = firstSentence.length <= 60 ? firstSentence : firstSentence.slice(0, 57) + '...';
      }

      if (!body) {
        body = pTrimmed;
      }

      return {
        title: title || `Guideline ${idx + 1}`,
        body,
      };
    });
  } else {
    candidateBlocks = sections
      .map((s, idx) => {
        let body = s.lines.join('\n').trim();
        let title = s.title.replace(/^[#\-*\s]+/, '').trim();

        // If body is empty, check if title has a colon or dash separating title and body
        if (!body && title.includes(':')) {
          const colonIdx = title.indexOf(':');
          const potentialTitle = title.slice(0, colonIdx).trim();
          const potentialBody = title.slice(colonIdx + 1).trim();
          if (potentialTitle.length >= 3 && potentialBody.length >= 5) {
            title = potentialTitle;
            body = potentialBody;
          }
        }

        if (!title || title.length < 3) {
          const firstSentence = body.split(/[.?!]\s+/)[0];
          title = firstSentence && firstSentence.length <= 60 ? firstSentence : `Guideline ${idx + 1}`;
        }

        return {
          title,
          body: body || title,
        };
      })
      .filter((b) => b.body.length >= 5 || b.title.length >= 3);
  }

  // Ensure maximum words limit per rule (default 300 words)
  const maxWords = CONFIG.MAX_GUIDELINE_IMPORT_WORDS || 300;
  const results: SplitGuidelineItem[] = [];

  for (const block of candidateBlocks) {
    const words = block.body.split(/\s+/).filter(Boolean);

    if (words.length <= maxWords) {
      results.push({
        title: cleanTitle(block.title),
        text: block.body.trim(),
      });
    } else {
      // Chunk into chunks of at most maxWords
      let chunkIdx = 1;
      for (let i = 0; i < words.length; i += maxWords) {
        const chunkWords = words.slice(i, i + maxWords);
        results.push({
          title: cleanTitle(`${block.title} (Part ${chunkIdx})`),
          text: chunkWords.join(' ').trim(),
        });
        chunkIdx++;
      }
    }
  }

  // Filter out any empty items and clamp string lengths
  return results
    .map((item) => ({
      title: item.title.slice(0, 100),
      text: item.text.slice(0, 3000),
    }))
    .filter((item) => item.title.length >= 3 && item.text.length >= 10);
}

function cleanTitle(title: string): string {
  const cleaned = title.replace(/^[#*\-•\d\.\:\s]+/, '').trim();
  if (cleaned.length < 3) return 'Guideline Rule';
  return cleaned.slice(0, 100);
}
