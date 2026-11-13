import { looksLikeHeading, type ResumeSectionKind, sectionOf } from '../posting/resume-lines';
import { normalizeLine } from './text';
import { startsWithVerb } from './verbs';

/**
 * Resume structure detection.
 *
 * A pasted resume rarely arrives with bullet glyphs intact, especially after
 * PDF or Google Docs extraction. Scoring every line as a bullet then grades a
 * name, a phone number, and "B.A. Communications, 2026" as weak achievements.
 * This module sorts lines into bullets and everything else, and explains
 * what it skipped so the student can see the reasoning.
 *
 * Lines are read inside their sections, found from heading lines. Nothing
 * under a skills or certifications heading is scored, bulleted or not: "-
 * Inventory Control" in a Core Skills sidebar names a skill, it does not
 * describe work, and grading it as a weak achievement would be unearned.
 */

export type SkippedKind =
  | 'contact'
  | 'heading'
  | 'education'
  | 'dates'
  | 'skills'
  | 'break'
  | 'other';

export interface ResumeStructure {
  /** Lines to score, glyphs stripped. */
  bullets: string[];
  /**
   * Positions in `text.split('\n')` of every line that went into a bullet,
   * wrapped continuations included. The highlighter marks only these.
   */
  achievementLines: number[];
  /** Lines left out of scoring, by reason. */
  skipped: Record<SkippedKind, number>;
  /** Lines that state a career break, left unscored: there is nothing to rewrite. */
  breaks: string[];
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

// Separators ("|", "｜", "—") are not words, so a role line is not made
// longer by the marks between its parts.
const wordCount = (line: string) =>
  line.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;

/**
 * A line as the classifier reads it: full-width bars as "|", and dates
 * written with numbers ("2021.09", "01/07/2025", "05/2027") as their year,
 * so "Research Assistant ｜ NTU ｜ 2021.09 – 2023.06" reads as a dated role.
 */
function probeLine(line: string): string {
  return line
    .replace(/[｜丨¦]/g, '|')
    .replace(/\b((?:19|20)\d{2})[./-](?:0?[1-9]|1[0-2])(?:[./-](?:0?[1-9]|[12]\d|3[01]))?\b/g, '$1')
    .replace(/\b(?:0?[1-9]|[12]\d|3[01])[./](?:0?[1-9]|[12]\d|3[01])[./]((?:19|20)\d{2})\b/g, '$1')
    .replace(/\b(?:0?[1-9]|1[0-2])[./]((?:19|20)\d{2})\b/g, '$1');
}

/**
 * Details a US resume usually leaves out (date of birth, nationality,
 * gender, marital status, a photo). They are never scored as achievements.
 */
export const PERSONAL_DETAIL =
  /\b(?:date of birth|d\.?o\.?b\.?|birth ?date|born (?:on|in)|nationality|citizenship|gender|sex|marital status|married|religion|age)\s*[:：]|\[?\s*photo(?:graph)? attached\s*\]?|^\s*\[photo\]\s*$/i;

/**
 * A career break said plainly: caregiving, parental or medical leave, a
 * layoff, time off. It is a fact about the dates, not an achievement, so it
 * is left unscored; grading it as a weak achievement would be unearned.
 */
const CAREER_BREAK = [
  /^(?:full[- ]time\s+|part[- ]time\s+)?(?:family\s+)?(?:caregiver|caregiving|carer)\b/i,
  /^(?:cared|caring)\s+for\s+(?:my\s+|a\s+|an\s+|our\s+)?(?:\w+\s+)?(?:parents?|mother|father|mom|dad|child|children|kids|baby|newborn|family|spouse|partner|husband|wife|grand\w+|relatives?|family members?)\b/i,
  /^(?:career break|parental leave|maternity leave|paternity leave|family leave|medical leave|sabbatical|planned break|time off|gap year)\b/i,
  /^(?:full[- ]time|stay[- ]at[- ]home)\s+(?:parent|mom|dad|mother|father|caregiver)\b/i,
  /^(?:took|taking)\s+(?:time off|a (?:career |planned )?break|(?:parental |medical |family )?leave)\b/i,
  /^(?:laid off|position (?:was )?eliminated|relocated (?:with|for) (?:my |a )?(?:family|spouse|partner))\b/i,
  /^(?:raised|raising)\s+(?:my\s+|our\s+)?(?:\w+\s+)?(?:children|kids|family|sons?|daughters?)\b/i,
];

/** True when a line states a career break rather than describing work. */
export function isCareerBreak(line: string): boolean {
  const text = line.replace(GLYPH, '').trim();
  return wordCount(text) <= 14 && CAREER_BREAK.some((pattern) => pattern.test(text));
}
const isAllCaps = (line: string) => /[A-Z]/.test(line) && line === line.toUpperCase();

const ENDS_IN_TITLE = new RegExp(`${JOB_TITLE_WORDS.source}$`, 'i');

/** A short "Title, Place" line with no sentence in it. */
function isTitleLine(line: string, wordsInLine: number): boolean {
  if (wordsInLine > 9 || /[.!?;]/.test(line) || /\d/.test(line)) return false;
  const [head, ...rest] = line.split(/\s*[,|•·]\s*|\s+[-–]\s+/);
  if (rest.length === 0 || !head) return false;
  const headWords = wordCount(head);
  return headWords >= 1 && headWords <= 4 && ENDS_IN_TITLE.test(head.trim());
}

function classify(raw: string, index: number, wordsInLine: number): SkippedKind | 'bullet' {
  const line = probeLine(raw);
  if (EMAIL.test(line) || PHONE.test(line) || PERSONAL_DETAIL.test(line)) return 'contact';
  // A short title ("Family Caregiver") stays a title; a sentence that states
  // the break ("Full-time caregiver for a parent after surgery") is the break.
  if (wordsInLine >= 4 && isCareerBreak(line)) return 'break';
  // A project address inside a sentence about the work ("Built example.com
  // for a campus club") is part of an achievement; a bare link row is contact.
  if (URL.test(line) && !(startsWithVerb(line) && wordsInLine >= 5)) return 'contact';
  // A short first line without digits or a verb is almost always the name.
  if (
    index === 0 &&
    wordsInLine <= 4 &&
    !SECTION_WORDS.test(line.replace(/[:\s]+$/, '')) &&
    !/\d/.test(line) &&
    !startsWithVerb(line)
  ) {
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
  // "Research Assistant, Department of Economics" opens with a word that can
  // be a verb, but the part before the comma ends in a job title: it names a
  // role, and the bullets under it are the achievements.
  if (isTitleLine(line, wordsInLine)) return 'dates';
  if (!startsWithVerb(line)) {
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

export interface StructureOptions {
  /**
   * Lines a structured copy of the file placed in a skills or certifications
   * section. They are left out wherever the text puts them, for a layout
   * whose sidebar is read between experience lines.
   */
  listedLines?: Iterable<string>;
}

/** Sections whose lines list things rather than describe work. */
const LIST_SECTIONS: ReadonlySet<ResumeSectionKind> = new Set(['skills', 'certification']);

const listKey = (line: string) => line.replace(GLYPH, '').replace(/\s+/g, ' ').trim().toLowerCase();

export function detectResumeStructure(
  text: string,
  options: StructureOptions = {}
): ResumeStructure {
  const listed = new Set(Array.from(options.listedLines ?? [], listKey));
  const sourceLines: number[] = [];
  const rawLines: string[] = [];
  text.split('\n').forEach((source, position) => {
    const line = source.replace(/\s+/g, ' ').trim();
    if (!line) return;
    rawLines.push(line);
    sourceLines.push(position);
  });
  const achievementLines: number[] = [];
  const skipped: Record<SkippedKind, number> = {
    contact: 0,
    heading: 0,
    education: 0,
    dates: 0,
    skills: 0,
    break: 0,
    other: 0,
  };
  const breaks: string[] = [];

  const glyphLines = rawLines.filter((line) => GLYPH.test(line));
  const usedGlyphs = glyphLines.length >= 1;

  const bullets: string[] = [];
  let continuingBullet = false;
  let section: ResumeSectionKind | null = null;
  rawLines.forEach((line, index) => {
    const glyph = GLYPH.test(line);
    // A short first line in capitals is the name, unless it names a section.
    const heading =
      !glyph && looksLikeHeading(line) && !(index === 0 && sectionOf(line) === 'other');
    if (heading) {
      section = sectionOf(line);
      skipped.heading += 1;
      continuingBullet = false;
      return;
    }
    // A job title with dates ends a list that ran on without a heading.
    if (!glyph && section && LIST_SECTIONS.has(section) && DATE_RANGE.test(line)) section = null;
    else if ((section && LIST_SECTIONS.has(section)) || listed.has(listKey(line))) {
      skipped[section === 'certification' ? 'education' : 'skills'] += 1;
      continuingBullet = false;
      return;
    }
    if (usedGlyphs) {
      if (GLYPH.test(line)) {
        const normalized = normalizeLine(line);
        if (normalized && isCareerBreak(normalized)) {
          skipped.break += 1;
          breaks.push(normalized);
          continuingBullet = false;
          return;
        }
        if (normalized) {
          bullets.push(normalized);
          achievementLines.push(sourceLines[index]);
        }
        continuingBullet = Boolean(normalized);
      } else {
        const kind = classify(line, index, wordCount(line));
        // PDF extraction can put the result on its own line. Join only a
        // plausible continuation; headings and contact/title lines end it.
        const previous = bullets[bullets.length - 1];
        // With markers in use, an unmarked line that starts in lowercase is a
        // wrapped continuation, never a new achievement.
        const startsAchievement = kind === 'bullet' && startsWithVerb(line) && !/^[a-z]/.test(line);
        const isContinuation =
          continuingBullet &&
          !startsAchievement &&
          previous &&
          !/[.!?]$/.test(previous) &&
          (/^[a-z(]/.test(line) ||
            /\b(?:in|for|with|using|across|through|and|or|by|to|of)$/i.test(previous)) &&
          (kind === 'bullet' || kind === 'other');
        if (isContinuation) {
          bullets[bullets.length - 1] = `${previous} ${line}`;
          achievementLines.push(sourceLines[index]);
        } else if (startsAchievement) {
          bullets.push(line);
          achievementLines.push(sourceLines[index]);
          continuingBullet = true;
        } else {
          continuingBullet = false;
          skipped[kind === 'bullet' ? 'other' : kind] += 1;
          if (kind === 'break') breaks.push(line);
        }
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
    if (kind === 'bullet') {
      bullets.push(normalized);
      achievementLines.push(sourceLines[index]);
    } else {
      skipped[kind] += 1;
      if (kind === 'break') breaks.push(normalized);
    }
  });

  const skippedTotal = Object.values(skipped).reduce((sum, n) => sum + n, 0);
  const parts: string[] = [];
  if (skipped.contact) parts.push(`${skipped.contact} contact`);
  if (skipped.heading) parts.push(`${skipped.heading} heading`);
  if (skipped.education) parts.push(`${skipped.education} education`);
  if (skipped.dates) parts.push(`${skipped.dates} title or date`);
  if (skipped.skills) parts.push(`${skipped.skills} skills`);
  if (skipped.break) parts.push(`${skipped.break} career break`);
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
    note = `No bullet markers found, so the ${bullets.length === 1 ? '1 line that reads as an achievement was' : `${bullets.length} lines that read as achievements were`} scored.${skippedText}`;
  }

  return { bullets, achievementLines, skipped, breaks, usedGlyphs, note };
}
