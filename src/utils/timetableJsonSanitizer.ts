/**
 * Timetable JSON Preprocessor & Sanitizer
 *
 * Safely normalizes and extracts JSON payloads pasted from ChatGPT or LLMs,
 * resolving common clipboard artifacts:
 * - HTML entities (&#x20;, &quot;, &nbsp;, etc.)
 * - Trailing line-continuation backslashes (\ at end of lines)
 * - Markdown code fences (```json ... ```)
 * - Surrounding explanatory commentary
 * - Escaped newlines and quote sequences (e.g. from string-escaped outputs)
 * - Trailing commas before brackets/braces
 * - Escaped structural delimiters outside string literals (\{, \}, \[, \], \:, \,)
 *
 * INVARIANT: Never blindly strips backslashes. Valid raw JSON with legitimate
 * escaped characters (e.g. \"quotes\" or \\ in notes/location) is preserved intact.
 */

/**
 * Decodes HTML entities commonly introduced when copying text from web interfaces.
 */
export function decodeHtmlEntities(str: string): string {
  if (!str || typeof str !== 'string') return '';

  const decodeOnce = (s: string) =>
    s
      .replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'")
      .replace(/&nbsp;/gi, ' ')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      // Hex entities: e.g. &#x20; -> space, &#x0A; -> newline
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
        const code = parseInt(hex, 16);
        return isNaN(code) ? _ : String.fromCharCode(code);
      })
      // Decimal entities: e.g. &#32; -> space, &#10; -> newline
      .replace(/&#([0-9]+);/g, (_, dec) => {
        const code = parseInt(dec, 10);
        return isNaN(code) ? _ : String.fromCharCode(code);
      })
      // Normalize non-breaking and zero-width spaces
      .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
      .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
      // Decode &amp; last so we don't break entity sequences like &amp;quot; prematurely
      .replace(/&amp;/gi, '&');

  let decoded = decodeOnce(str);
  // Handle double-encoded entities (e.g. &amp;#x20;)
  if (decoded !== str && /&(?:[a-z]+|#\d+|#x[0-9a-f]+);/i.test(decoded)) {
    decoded = decodeOnce(decoded);
  }
  return decoded;
}

/**
 * Removes trailing line-continuation backslashes before actual newlines or at the end of text.
 * E.g. `{ \ \n` or `,\n` with `\` or ````json \ ````.
 */
export function stripLineContinuationBackslashes(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/\\+[ \t]*(?:\r?\n|$)/g, '\n');
}

/**
 * Strips backslashes that occur outside of JSON string literals.
 * In the JSON specification (RFC 8259), backslashes can ONLY appear inside string literals ("...").
 * Backslashes outside strings (such as escaped markdown delimiters \{, \}, \[, \], \:, \, or stray backslashes)
 * are invalid in JSON and are safely removed.
 * Legitimate escapes INSIDE string literals (\"quotes\", \\, \n, \t, etc.) are strictly preserved.
 */
export function stripBackslashesOutsideStrings(str: string): string {
  if (!str || typeof str !== 'string') return '';
  let result = '';
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (inString) {
      result += char;
      if (escapeNext) {
        escapeNext = false;
      } else if (char === '\\') {
        escapeNext = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    // Outside string literal
    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }

    if (char === '\\') {
      const nextChar = str[i + 1];
      // If it's escaping markdown delimiters, whitespace, or another backslash outside strings, drop it
      if (nextChar && (/[{}\[\]:, \t\r\n]/.test(nextChar) || nextChar === '\\')) {
        continue;
      }
      // If backslash is followed by quote outside string (e.g. \"), preserve it for quote-unwrapper
    }

    result += char;
  }

  return result;
}

/**
 * Finds top-level balanced `{ ... }` blocks in text, ignoring braces inside string literals.
 * Supports both standard string quotes ("...") and escaped string quotes (\"...\").
 */
export function findBalancedJsonBlocks(str: string): string[] {
  const blocks: string[] = [];
  let depth = 0;
  let startIndex = -1;
  let inStringMode: null | 'normal' | 'escaped' = null;
  let escapeNext = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const nextChar = str[i + 1];

    if (inStringMode === 'normal') {
      if (escapeNext) {
        escapeNext = false;
      } else if (char === '\\') {
        escapeNext = true;
      } else if (char === '"') {
        inStringMode = null;
      }
      continue;
    }

    if (inStringMode === 'escaped') {
      if (escapeNext) {
        escapeNext = false;
      } else if (char === '\\' && nextChar === '\\') {
        i++; // skip escaped backslash
      } else if (char === '\\' && nextChar === '"') {
        inStringMode = null;
        i++; // skip escaped quote closing this string
      }
      continue;
    }

    // Outside string
    if (char === '\\' && nextChar === '"') {
      inStringMode = 'escaped';
      i++;
      continue;
    }

    if (char === '"') {
      inStringMode = 'normal';
      continue;
    }

    if (char === '{') {
      if (depth === 0) {
        startIndex = i;
      }
      depth++;
    } else if (char === '}') {
      if (depth > 0) {
        depth--;
        if (depth === 0 && startIndex !== -1) {
          blocks.push(str.substring(startIndex, i + 1));
          startIndex = -1;
        }
      }
    }
  }

  return blocks;
}

/**
 * Extracts candidate JSON string from markdown blocks, string wrappers, or surrounding text.
 */
export function extractCandidateJsonString(raw: string): string {
  let text = raw.trim();

  // Strip line-continuation backslashes before processing fences so ```json \ matches cleanly
  text = stripLineContinuationBackslashes(text);

  // 1. Check for markdown code fences: ```(?:json)? ... ```
  const fenceMatches = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)];
  if (fenceMatches.length === 1 && fenceMatches[0][1]) {
    text = fenceMatches[0][1].trim();
  } else if (fenceMatches.length > 1) {
    const timetableFences = fenceMatches.filter(
      (m) => m[1] && m[1].includes('student-tracker-timetable')
    );
    if (timetableFences.length === 1) {
      text = timetableFences[0][1].trim();
    } else if (timetableFences.length > 1) {
      throw new Error(
        'Multiple timetable code blocks found in pasted text. Please paste only the timetable schedule you want to import.'
      );
    }
  }

  // 2. If wrapped in outer quotes as a JSON string literal e.g. "{\n  \"format\": ...}"
  if (text.startsWith('"') && text.endsWith('"') && text.length > 2) {
    try {
      const unquoted = JSON.parse(text);
      if (typeof unquoted === 'string') {
        text = unquoted.trim();
      }
    } catch {}
  }

  // 3. Extract balanced top-level JSON objects from surrounding commentary
  const blocks = findBalancedJsonBlocks(text);
  if (blocks.length === 1) {
    text = blocks[0];
  } else if (blocks.length > 1) {
    const timetableBlocks = blocks.filter((b) => b.includes('student-tracker-timetable'));
    if (timetableBlocks.length === 1) {
      text = timetableBlocks[0];
    } else if (timetableBlocks.length > 1) {
      throw new Error(
        'Multiple timetable schedules found in pasted text. Please paste only the timetable schedule you want to import.'
      );
    }
  } else {
    // Fallback: extract between outermost braces if balanced scanner found no full match
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      text = text.substring(firstBrace, lastBrace + 1);
    }
  }

  return text;
}

/**
 * Preprocesses and parses timetable JSON from user paste.
 * Throws a descriptive, user-friendly error if the input cannot be parsed.
 */
export function preprocessAndParseTimetableJson(rawInput: string): any {
  if (!rawInput || typeof rawInput !== 'string' || !rawInput.trim()) {
    throw new Error('Please paste the JSON generated by ChatGPT into the text area.');
  }

  // Step 1: Decode HTML entities (e.g. &#x20;, &quot;, &nbsp;)
  let text = decodeHtmlEntities(rawInput);

  // Step 2: Strip line-continuation backslashes
  text = stripLineContinuationBackslashes(text);

  // Step 3: Extract candidate JSON string from markdown fences or commentary
  text = extractCandidateJsonString(text);

  // Step 4: Fast-path direct parse (preserves legitimate escapes in valid JSON)
  try {
    const direct = JSON.parse(text);
    if (typeof direct === 'string') {
      const second = JSON.parse(direct);
      if (second && typeof second === 'object' && second !== null) return second;
    }
    if (direct && typeof direct === 'object' && direct !== null) {
      return direct;
    }
  } catch {
    // Continue to normalization fallbacks
  }

  // Step 5: Normalize backslashes outside strings & line-continuations
  let normalized = stripLineContinuationBackslashes(text);
  normalized = stripBackslashesOutsideStrings(normalized);

  // Step 6: Handle trailing commas in JSON before brackets/braces
  try {
    const strippedTrailingCommas = normalized.replace(/,\s*([\]}])/g, '$1');
    const parsed = JSON.parse(strippedTrailingCommas);
    if (parsed && typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }
  } catch {}

  // Step 7: Handle escaped quotes and newlines where outer quotes were omitted
  // E.g. `{\n  \"format\": \"student-tracker-timetable\"...}`
  if (text.includes('\\"') || text.includes('\\n') || text.includes('\\r')) {
    try {
      const wrapped = `"${normalized.replace(/[\r\n]+/g, '\\n')}"`;
      const unescaped = JSON.parse(wrapped);
      if (typeof unescaped === 'string') {
        const parsed = JSON.parse(unescaped.replace(/,\s*([\]}])/g, '$1'));
        if (parsed && typeof parsed === 'object' && parsed !== null) {
          return parsed;
        }
      }
    } catch {}

    try {
      // Direct selective unescaping: replace escaped quotes and structural newlines
      const selectiveUnescaped = normalized
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/,\s*([\]}])/g, '$1');
      const parsed = JSON.parse(selectiveUnescaped);
      if (parsed && typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
    } catch {}
  }

  // Step 8: If all attempts fail, throw a friendly actionable error message
  throw new Error(
    'Invalid JSON format. Please verify that you copied the complete JSON block from ChatGPT.'
  );
}

