import {
  decodeHtmlEntities,
  findBalancedJsonBlocks,
  stripBackslashesOutsideStrings,
  stripLineContinuationBackslashes,
} from './timetableJsonSanitizer';

/**
 * Normalize common ChatGPT/browser clipboard artifacts and parse calendar JSON.
 * Valid JSON is always tried first so legitimate escapes inside event text remain intact.
 */
export function preprocessAndParseCalendarJson(rawInput: string): unknown {
  if (!rawInput || typeof rawInput !== 'string' || !rawInput.trim()) {
    throw new Error('Please paste the JSON returned by ChatGPT.');
  }

  let text = stripLineContinuationBackslashes(decodeHtmlEntities(rawInput)).trim();

  const fences = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)];
  if (fences.length === 1 && fences[0][1]) {
    text = fences[0][1].trim();
  } else if (fences.length > 1) {
    const calendarFences = fences.filter((match) => /"(?:events|tasks)"\s*:/i.test(match[1] || ''));
    if (calendarFences.length === 1) text = calendarFences[0][1].trim();
    else if (calendarFences.length > 1) {
      throw new Error('Multiple calendar JSON blocks found. Paste only the events and tasks JSON you want to import.');
    }
  }

  // Unwrap JSON encoded as a quoted string, when ChatGPT or the clipboard adds one.
  if (text.startsWith('"') && text.endsWith('"')) {
    try {
      const unwrapped: unknown = JSON.parse(text);
      if (typeof unwrapped === 'string') text = unwrapped.trim();
    } catch {
      // Continue with ordinary JSON extraction.
    }
  }

  const blocks = findBalancedJsonBlocks(text);
  if (blocks.length === 1) {
    text = blocks[0];
  } else if (blocks.length > 1) {
    const calendarBlocks = blocks.filter((block) => /"(?:events|tasks)"\s*:/i.test(block));
    if (calendarBlocks.length === 1) text = calendarBlocks[0];
    else if (calendarBlocks.length > 1) {
      throw new Error('Multiple calendar JSON objects found. Paste only the events and tasks JSON you want to import.');
    }
  } else {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) text = text.slice(firstBrace, lastBrace + 1);
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === 'string') {
      const nested: unknown = JSON.parse(parsed);
      if (nested && typeof nested === 'object') return nested;
    }
    if (text && typeof parsed === 'object') return parsed;
  } catch {
    // Normalize malformed clipboard formatting below.
  }

  const normalized = stripBackslashesOutsideStrings(stripLineContinuationBackslashes(text));
  const withoutTrailingCommas = normalized.replace(/,\s*([\]}])/g, '$1');
  try {
    const parsed: unknown = JSON.parse(withoutTrailingCommas);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    // Try the common escaped-JSON paste format below.
  }

  if (text.includes('\\"') || text.includes('\\n') || text.includes('\\r')) {
    const selectivelyUnescaped = withoutTrailingCommas
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t');
    try {
      const parsed: unknown = JSON.parse(selectivelyUnescaped);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // Return one consistent, actionable message below.
    }
  }

  throw new Error('Invalid JSON format. Paste the complete events and tasks JSON from ChatGPT.');
}
