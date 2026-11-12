/**
 * Line scanning for pasted job postings: headings, boilerplate, and noise
 * are told apart from lines that may describe the job. Moved here from
 * glowup-banks.ts, which re-exports `extractRequirementLines` unchanged in
 * shape. Every line keeps its offsets in the raw text.
 */

import { wordCount } from './text';

const SECTION_HEADER_PATTERNS: RegExp[] = [
  /^about\s+(us|you|me|the\s+(role|job|team|company|position))\b/i,
  /^who\s+(we\s+are|you\s+are)\b/i,
  /^what\s+(you.ll\s+(do|bring|own|need)|we\s+(do|offer|value))\b/i,
  /^(responsibilities|requirements|qualifications|duties|benefits|perks|compensation|overview|summary|our\s+(mission|values|story|culture|benefits)|the\s+(role|team|company)|nice\s+to\s+haves?|bonus\s+points?|preferred\s+qualifications|minimum\s+qualifications|basic\s+qualifications|why\s+join(\s+us)?|why\s+you.ll\s+love\s+it|how\s+to\s+apply|application\s+process|salary(\s+range)?|pay\s+range|location|job\s+(type|description|summary)|key\s+responsibilities|your\s+(role|impact|profile)|in\s+this\s+role)\b.{0,40}$/i,
];

const BOILERPLATE_PATTERNS: RegExp[] = [
  // Equal-opportunity / legal boilerplate
  /equal\s+(employment\s+)?opportunit/i,
  /without\s+regard\s+to/i,
  /\beeo\b/i,
  /affirmative\s+action/i,
  /reasonable\s+accommodat/i,
  /e-?verify/i,
  /background\s+check/i,
  /protected\s+(veteran|class|characteristic|status)/i,
  /regardless\s+of\s+(race|gender|age)/i,
  /drug[-\s]free\s+workplace/i,
  // Benefits and compensation boilerplate
  /401\s?\(?k\)?/i,
  /\b(dental|vision)\s+(insurance|coverage|plan)/i,
  /health\s+(insurance|benefits|coverage)/i,
  /\bpaid\s+time\s+off\b|\bpto\b/i,
  /parental\s+leave/i,
  /stock\s+options|equity\s+(package|grant)/i,
  /tuition\s+(reimbursement|assistance)/i,
  /commuter\s+benefits/i,
  /(salary|pay|compensation)\s+range/i,
  /base\s+salary/i,
  /wellness\s+(stipend|program)/i,
  // About-us marketing boilerplate
  /founded\s+in\s+\d{4}/i,
  /our\s+mission\s+is/i,
  /\bmillions?\s+of\s+(users|customers|people)\b/i,
  /venture[-\s]backed|series\s+[a-e]\b/i,
  /fortune\s+\d+/i,
  /apply\s+(now|today)\b/i,
  /learn\s+more\s+at/i,
  /visit\s+(our\s+website|us\s+at)/i,
];

// Pre-compile multi-pattern arrays into single combined RegExp objects to avoid iterating
// through up to 27 individual regexes on every line during job description requirement extraction.
const COMBINED_SECTION_HEADER_PATTERN = new RegExp(
  SECTION_HEADER_PATTERNS.map((p) => p.source).join('|'),
  'i'
);

const COMBINED_BOILERPLATE_PATTERN = new RegExp(
  BOILERPLATE_PATTERNS.map((p) => p.source).join('|'),
  'i'
);

export function isSectionHeader(line: string): boolean {
  const words = wordCount(line);
  // Short line ending in a colon reads as a heading.
  if (words <= 6 && /:\s*$/.test(line)) return true;
  // ALL CAPS short lines are headings.
  if (words <= 6 && line.length >= 3 && line === line.toUpperCase() && /[A-Z]/.test(line)) {
    return true;
  }
  if (words <= 10 && COMBINED_SECTION_HEADER_PATTERN.test(line)) return true;
  return false;
}

export function isBoilerplate(text: string): boolean {
  return COMBINED_BOILERPLATE_PATTERN.test(text);
}

/**
 * "Brightline Health - Remote (US)" or "Software Engineer II | New York" is a
 * header, not a requirement: short, mostly capitalized, no verb-shaped words.
 */
export function looksLikeHeaderLine(line: string): boolean {
  const words = line.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w));
  if (words.length === 0 || words.length > 8) return false;
  const capitalized = words.filter((w) => /^[A-Z(]/.test(w)).length;
  const hasSeparator = /[|\-–—]/.test(line) || /\((?:US|USA|UK|EU|CA|Remote)\)/i.test(line);
  return capitalized / words.length >= 0.7 && (hasSeparator || words.length <= 4);
}

/** A line with fewer words than this is noise, not a requirement. */
export const MIN_REQUIREMENT_WORDS = 4;

/**
 * Upper bound on requirement lines kept from one paste. Was 40; real
 * postings with long responsibility lists passed that, and every dropped line
 * is counted, so the bound now only guards against pasting a whole web page.
 */
export const MAX_REQUIREMENT_LINES = 120;

const BULLET_MARKER = /^([•\-*◦○●‣⁃▪▫■□➢➤►–—✓✔·])\s*/;
// "1. " or "a) ", but not the "3." in "3.0 GPA required".
const NUMBER_MARKER = /^(?:\d{1,2}|[a-z])[.)](?=\s)\s*/;

/** Glyphs that mark a nested bullet even when the paste lost its indentation. */
export const NESTED_MARKERS = new Set(['◦', '○', '▪', '▫', '‣', '⁃', '□', '–']);

export interface ScannedLine {
  /** The line with whitespace and its list marker removed. */
  text: string;
  /** Offsets of `text` in the raw posting. */
  start: number;
  end: number;
  /** Leading whitespace width, tabs counted as four. */
  indent: number;
  /** The bullet glyph or number marker, or null for a plain line. */
  marker: string | null;
}

/** Every non-empty line of `rawText` with its list marker stripped and its offsets kept. */
export function scanPostingLines(rawText: string): ScannedLine[] {
  const lines: ScannedLine[] = [];
  let lineStart = 0;
  while (lineStart <= rawText.length) {
    let lineEnd = rawText.indexOf('\n', lineStart);
    if (lineEnd === -1) lineEnd = rawText.length;
    const line = rawText.slice(lineStart, lineEnd);

    const leading = line.match(/^\s*/)?.[0] ?? '';
    const indent = leading.replace(/\t/g, '    ').length;
    let offset = leading.length;
    let rest = line.slice(offset);
    let marker: string | null = null;

    const bullet = rest.match(BULLET_MARKER);
    if (bullet) {
      marker = bullet[1];
      offset += bullet[0].length;
      rest = rest.slice(bullet[0].length);
    }
    const numbered = rest.match(NUMBER_MARKER);
    if (numbered) {
      marker = marker ?? numbered[0].trim();
      offset += numbered[0].length;
      rest = rest.slice(numbered[0].length);
    }

    const text = rest.trim();
    if (text) {
      const start = lineStart + offset + (rest.length - rest.trimStart().length);
      lines.push({ text, start, end: start + text.length, indent, marker });
    }
    lineStart = lineEnd + 1;
  }
  return lines;
}

export type LineKind = 'too-short' | 'heading' | 'boilerplate' | 'header-line' | 'content';

/** The original decode screen's verdict on one line. */
export function classifyLegacyLine(text: string): LineKind {
  if (wordCount(text) < MIN_REQUIREMENT_WORDS) return 'too-short';
  if (isSectionHeader(text)) return 'heading';
  if (isBoilerplate(text)) return 'boilerplate';
  if (looksLikeHeaderLine(text)) return 'header-line';
  return 'content';
}

export interface JdExtractionResult {
  /** Lines that plausibly describe skills or responsibilities. */
  requirements: string[];
  /** Non-empty lines dropped as headings, boilerplate, or noise. */
  skippedCount: number;
}

/**
 * Line-based extraction used by the Glow Up decode screen. The posting
 * engine's `parsePosting` builds on the same scanner and filters and adds
 * sections, sentences, and spans.
 */
export function extractRequirementLines(rawText: string): JdExtractionResult {
  const requirements: string[] = [];
  let skippedCount = 0;

  for (const line of scanPostingLines(rawText)) {
    if (classifyLegacyLine(line.text) !== 'content') {
      skippedCount++;
      continue;
    }
    if (requirements.length < MAX_REQUIREMENT_LINES) {
      requirements.push(line.text);
    } else {
      skippedCount++;
    }
  }

  return { requirements, skippedCount };
}
