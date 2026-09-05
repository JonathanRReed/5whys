import { BULLET_START_PATTERN } from './constants';
import { normalizeLine } from './text';

/**
 * Resume structure detection.
 *
 * A pasted resume rarely arrives with bullet glyphs intact, especially after
 * PDF or Google Docs extraction. Scoring every line as a bullet then grades a
 * name, a phone number, and "B.A. Communications, 2026" as weak achievements.
 * This module sorts lines into bullets and everything else, and explains
 * what it skipped so the student can see the reasoning.
 */

export type SkippedKind = 'contact' | 'heading' | 'education' | 'dates' | 'skills' | 'other';

export interface ResumeStructure {
  /** Lines to score, glyphs stripped. */
  bullets: string[];
  /** Lines left out of scoring, by reason. */
  skipped: Record<SkippedKind, number>;
  /** True when the text carried bullet markers and they were used. */
  usedGlyphs: boolean;
  /** One sentence for the report explaining what was scored. */
  note: string;
}

const GLYPH = /^[-•*◦○●▪–—]\s+/;
const EMAIL = /\S+@\S+\.\S+/;
const PHONE = /(?:\+?\d{1,2}[\s.-])?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/;
const URL = /\b(https?:\/\/|www\.|linkedin\.com|github\.com|\w+\.(com|io|dev|org|net)\b)/i;
const YEAR = /\b(19|20)\d{2}\b/;
const DATE_RANGE = /\b(19|20)\d{2}\b\s*(?:[-–—]|to)\s*(?:\b(19|20)\d{2}\b|present|current|now)/i;
const MONTH =
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december|spring|summer|fall|autumn|winter)\b/i;
const SECTION_WORDS =
  /^(summary|objective|profile|about( me)?|experience|work experience|professional experience|employment|education|skills|technical skills|core competencies|projects|relevant projects|leadership|activities|extracurriculars?|volunteer(ing)?( experience)?|awards|honors|certifications?|languages|interests|references|coursework|relevant coursework|publications|research( experience)?|contact)$/i;
const EDUCATION =
  /\b(university|college|institute|bachelor|master|associate|b\.?\s?[as]\.?|m\.?\s?[as]\.?|b\.?s\.?c|ph\.?d|gpa|dean'?s list|honou?r roll|high school|expected (graduation|grad)|major|minor|class of|cum laude)\b/i;
const SKILLS_LABEL =
  /^(skills|tools|languages|technologies|software|technical skills|proficiencies)\s*:/i;
const JOB_TITLE_WORDS =
  /\b(intern|internship|assistant|associate|analyst|coordinator|specialist|manager|engineer|developer|designer|consultant|representative|volunteer|tutor|cashier|barista|server|clerk|technician|fellow|president|treasurer|secretary|captain|member|founder|co-founder|lead)\b/i;

const wordCount = (line: string) => line.split(/\s+/).filter(Boolean).length;
const isAllCaps = (line: string) => /[A-Z]/.test(line) && line === line.toUpperCase();

function classify(line: string, index: number, wordsInLine: number): SkippedKind | 'bullet' {
  if (EMAIL.test(line) || PHONE.test(line) || URL.test(line)) return 'contact';
  // A short first line without digits or a verb is almost always the name.
  if (index === 0 && wordsInLine <= 4 && !/\d/.test(line) && !BULLET_START_PATTERN.test(line)) {
    return 'contact';
  }
  const clean = line.replace(/[:\s]+$/, '');
  if (wordsInLine <= 4 && (SECTION_WORDS.test(clean) || isAllCaps(clean) || /:$/.test(line))) {
    return 'heading';
  }
  if (SKILLS_LABEL.test(line)) return 'skills';
  // "Member, Marketing Club, 2024 - 2025" is a title line, not an achievement,
  // even though it opens with an involvement verb.
  if (DATE_RANGE.test(line) && wordsInLine <= 10 && /[|,•·]/.test(line)) return 'dates';
  const startsWithVerb = BULLET_START_PATTERN.test(line);
  if (!startsWithVerb) {
    if (EDUCATION.test(line) && wordsInLine <= 14) return 'education';
    if (DATE_RANGE.test(line) && wordsInLine <= 14) return 'dates';
    if (
      (YEAR.test(line) || MONTH.test(line)) &&
      wordsInLine <= 10 &&
      (JOB_TITLE_WORDS.test(line) || /[|,•·]/.test(line))
    ) {
      return 'dates';
    }
    const separators = (line.match(/[,|•·]/g) ?? []).length;
    if (separators >= 3 && wordsInLine <= 24) return 'skills';
    if (wordsInLine < 6) return 'other';
  }
  return 'bullet';
}

export function detectResumeStructure(text: string): ResumeStructure {
  const rawLines = text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const skipped: Record<SkippedKind, number> = {
    contact: 0,
    heading: 0,
    education: 0,
    dates: 0,
    skills: 0,
    other: 0,
  };

  const glyphLines = rawLines.filter((line) => GLYPH.test(line));
  const usedGlyphs = glyphLines.length >= 2;

  const bullets: string[] = [];
  rawLines.forEach((line, index) => {
    if (usedGlyphs) {
      if (GLYPH.test(line)) {
        const normalized = normalizeLine(line);
        if (normalized) bullets.push(normalized);
      } else {
        // With markers present, unmarked lines are structure, not achievements.
        const kind = classify(line, index, wordCount(line));
        skipped[kind === 'bullet' ? 'other' : kind] += 1;
      }
      return;
    }
    const normalized = normalizeLine(line);
    if (!normalized) {
      // normalizeLine drops bare section headings and date ranges; count them
      // so the note can say they were recognized rather than silently lost.
      if (line.replace(/[^a-zA-Z0-9]/g, '').length >= 3) {
        const kind = classify(line, index, wordCount(line));
        skipped[kind === 'bullet' ? 'other' : kind] += 1;
      }
      return;
    }
    const kind = classify(normalized, index, wordCount(normalized));
    if (kind === 'bullet') bullets.push(normalized);
    else skipped[kind] += 1;
  });

  const skippedTotal = Object.values(skipped).reduce((sum, n) => sum + n, 0);
  const parts: string[] = [];
  if (skipped.contact) parts.push(`${skipped.contact} contact`);
  if (skipped.heading) parts.push(`${skipped.heading} heading`);
  if (skipped.education) parts.push(`${skipped.education} education`);
  if (skipped.dates) parts.push(`${skipped.dates} title or date`);
  if (skipped.skills) parts.push(`${skipped.skills} skills`);
  if (skipped.other) parts.push(`${skipped.other} short`);
  const skippedText =
    skippedTotal > 0
      ? ` Left ${skippedTotal === 1 ? '1 line' : `${skippedTotal} lines`} out of scoring (${parts.join(', ')}).`
      : '';

  let note: string;
  if (bullets.length === 0) {
    note =
      'No achievement lines found. Add bullets that start with what you did, one action per line.';
  } else if (usedGlyphs) {
    note = `Scored the ${bullets.length === 1 ? '1 bulleted line' : `${bullets.length} bulleted lines`}.${skippedText}`;
  } else {
    note = `No bullet markers found, so the ${bullets.length === 1 ? '1 line' : `${bullets.length} lines`} that read as achievements were scored.${skippedText}`;
  }

  return { bullets, skipped, usedGlyphs, note };
}
