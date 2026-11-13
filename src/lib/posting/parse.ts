/**
 * Section-aware parsing of a pasted job posting. Every requirement is one
 * sentence (or one nested bullet group) with its offsets in the raw text and
 * the evidence for its section. Nothing is fetched; nothing is guessed.
 */

import {
  classifyLegacyLine,
  isBoilerplate,
  isSectionHeader,
  MAX_REQUIREMENT_LINES,
  MIN_REQUIREMENT_WORDS,
  NESTED_MARKERS,
  type ScannedLine,
  scanPostingLines,
} from './lines';
import { extractRequirementTerms } from './match';
import { startsWithAction } from './resume-lines';
import {
  decideSection,
  findCues,
  type HeadingMeaning,
  headingMeaning,
  inlineHeading,
  type SectionContext,
} from './sections';
import { mergeShortSegments, splitSentences, type TextSegment, wordCount } from './text';
import type {
  OccupationLookup,
  OccupationMatch,
  PostingRequirement,
  SectionClassification,
  SourceSpan,
} from './types';
import { findVaguePhrases, type VaguePhraseHit } from './vague-phrases';

export type SetAsideReason =
  /** A heading; it shapes the lines below it. */
  | 'heading'
  /** Fewer words than a requirement needs, outside any requirement section. */
  | 'too-short'
  /** Legal, benefits, or marketing boilerplate. */
  | 'boilerplate'
  /** A title or location line such as "Data Analyst | Remote". */
  | 'header-line'
  /** A job detail rather than a requirement: "Location: Austin, TX", "$17 per hour". */
  | 'job-details'
  /** Under a heading such as "About us", "Benefits", or "How to apply". */
  | 'outside-requirements'
  /** A bullet that introduces nested bullets ("Experience with one of the following:"). */
  | 'group-lead'
  /** Past the requirement limit. */
  | 'over-limit'
  /** Deadlines, how to apply, and when applications are reviewed. */
  | 'application-logistics'
  /** What the company is or does: "Northgate is a growing logistics provider." */
  | 'company-description'
  /** A summary of the role rather than a duty: "As Project Coordinator you will support project managers ..." */
  | 'role-summary'
  /** Selling the job: "a great opportunity for a rockstar", "the glue between the floor and our carriers". */
  | 'pitch'
  /** A line with no heading or cue that reads as neither a requirement nor a duty. */
  | 'description';

export interface SetAsideLine extends SourceSpan {
  text: string;
  reason: SetAsideReason;
}

export interface PostingHeading extends SourceSpan {
  text: string;
  meaning: HeadingMeaning;
}

export interface ParsedPosting {
  /** The exact text that was parsed. Every span indexes into it. */
  text: string;
  /** Requirements in reading order, all `suggested` and `parsed`. */
  requirements: PostingRequirement[];
  headings: PostingHeading[];
  /** Everything not kept as a requirement, with the reason, so nothing disappears silently. */
  setAside: SetAsideLine[];
  /** How many requirement sentences fell past the limit. They are also in `setAside`. */
  overLimitCount: number;
  vaguePhrases: VaguePhraseHit[];
  /** Job titles named in the posting, when a lookup was supplied. */
  titles: OccupationMatch[];
}

export interface ParseOptions {
  /** Optional title and software-skills dataset. Never loaded by the engine. */
  lookup?: OccupationLookup;
  /** Upper bound on requirements kept. Defaults to MAX_REQUIREMENT_LINES. */
  maxRequirements?: number;
}

/** Stable across re-parsing the same text, so saved state can find its requirement again. */
export function parsedRequirementId(span: SourceSpan): string {
  return `p-${span.start}-${span.end}`;
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[;,]\s*$/, '')
    .trim();
}

function isClassifiedContext(context: SectionContext | null): boolean {
  return (
    context !== null &&
    (context.meaning === 'required' ||
      context.meaning === 'preferred' ||
      context.meaning === 'responsibility')
  );
}

function isNestedUnder(child: ScannedLine, parent: ScannedLine): boolean {
  if (child.indent > parent.indent) return true;
  if (child.indent < parent.indent || !child.marker || !parent.marker) return false;
  if (child.marker === parent.marker) return false;
  return (
    NESTED_MARKERS.has(child.marker) ||
    (/^[•●]$/.test(parent.marker) && /^[-*]$/.test(child.marker))
  );
}

const JOB_DETAIL_LINE =
  /^(?:location|locations|schedule|hours|shift|shifts|pay|pay rate|wage|wages|salary|compensation|rate|job type|employment type|position type|start date|duration|department|reports to|team|travel|work model|workplace type|openings|posted|deadline|application deadline)\s*:|^\$\s?\d[\d,.]*(?:\s*(?:-|–|to)\s*\$?\s?\d[\d,.]*)?\s*(?:\/|per\s+|an?\s+)(?:hour|hr|year|yr|week|month)\b/i;

/** A sentence about pay, weekly hours, or how to apply, with no requirement cue of its own. */
const JOB_DETAIL_SENTENCE =
  /\$\s?\d|\b\d+\s*(?:(?:-|–|to)\s*\d+\s*)?hours\s+(?:per|a|each)\s+week\b|^apply\s+(?:by|before|online|through|via|at|now|today)\b|^to\s+apply\b|^salary\b|\bcommensurate\s+with\b/i;

/** Deadlines, review timing, and how to apply. Set aside wherever they appear. */
const APPLICATION_LOGISTICS =
  /\bapplications?\s+(?:close|closes|closing|are\s+due|due|deadline|(?:are\s+|will\s+be\s+)?(?:reviewed|accepted|considered))\b|\brolling\s+basis\b|\b(?:application|posting|closing)\s+(?:deadline|date)\b|\bposting\s+(?:closes|will\s+close|expires)\b|^deadline\b|\b(?:apply|submit\s+(?:your\s+)?(?:resume|application|materials))\s+(?:by|before|no\s+later\s+than)\b|\b(?:only\s+)?(?:selected|shortlisted|qualified)\s+(?:candidates|applicants)\s+will\s+be\s+contacted\b|^(?:please\s+)?(?:send|email|submit)\s+(?:your\s+)?(?:resume|cv|cover\s+letter|application)\b|\binterviews?\s+(?:will\s+)?(?:begin|start)\b/i;

const LOCATION_LINE =
  /\b[A-Z][a-z]+,\s*[A-Z]{2}\b|\b(?:remote|hybrid|on[- ]site|in[- ]person)\b|\bup\s+to\s+\d+%\s+travel\b/;

const JOB_TITLE_WORD =
  /\b(?:intern|assistant|associate|analyst|coordinator|specialist|manager|supervisor|engineer|developer|designer|representative|clerk|technician|lead|director|officer|agent|attendant|guide|aide|cashier|barista|server|cook|tutor|fellow)s?\b/i;

/** "As Project Coordinator you will ...", "The Operations Coordinator keeps ...", "In this role you will ...". */
const ROLE_SUMMARY =
  /^as\s+(?:an?\s+|the\s+|our\s+)?[A-Z][\w-]*(?:\s+[A-Z&][\w-]*){0,4},?\s+you\b|^in\s+this\s+(?:role|position|job|internship),?\s+you\b|^this\s+(?:role|position|job)\s+(?:is|will)\b/i;

const NAMED_SUBJECT =
  /^(?:the\s+)?[A-Z][\w&'.-]*(?:\s+(?:[A-Z&][\w&'.-]*|of|and|for))*\s+(?:is|are|was|has|have|operates|serves|provides|runs|offers|builds|makes|helps|keeps|delivers|specializes|plays|sits|supports|owns|works|will)\b/;

const COMPANY_DESCRIPTION =
  /^(?:we|we're|we\s+are|our)\b|^(?:this|it)\s+is\s+(?:a|an)\b|\bis\s+hiring\b|\bfounded\s+in\b|\bheadquartered\s+in\b/i;

const PITCH =
  /\b(?:great|exciting|amazing|unique|rare)\s+opportunity\b|\bthe\s+glue\b|^join\b|\bjoin\s+(?:us|our\s+team)\b|\bwe(?:'re|\s+are)\s+looking\s+for\b|\byou(?:'ll|\s+will)\s+love\b|\bperfect\s+fit\b|\bif\s+this\s+sounds\s+like\s+you\b/i;

/** Phrasing that asks something of the applicant. */
const REQUIREMENT_PHRASING =
  /^(?:\d+\+?\s*(?:-\s*\d+\s*)?(?:years?|months?)|experience|knowledge|familiarity|proficien|ability|able\s+to|must|bachelor|master|degree|high\s+school|valid|currently\s+(?:enrolled|pursuing)|certifi|licens|strong|excellent|working\s+knowledge|comfort|fluen|availab|basic|advanced|demonstrated|proven|exposure)|\b(?:experience\s+(?:with|in|using|as)|knowledge\s+of|proficien(?:t|cy)\s+(?:in|with)|familiar(?:ity)?\s+with|ability\s+to|able\s+to|skills?\s+(?:in|with)|comfortable\s+(?:with|using)|certifi|licens|degree\b|years?\s+of|ideal\s+candidate|you\s+(?:have|bring|know|can)\b)/i;

/** "You will check materials in and out": a duty. "You will be the glue ...": not one. */
const YOU_WILL =
  /^(?:you(?:'ll|\s+will|\s+would)|in\s+this\s+role,?\s+you(?:'ll|\s+will))\s+(?:also\s+)?([a-z]+)/i;
const NOT_DUTY_VERBS = new Set([
  'be',
  'have',
  'join',
  'love',
  'enjoy',
  'thrive',
  'get',
  'wear',
  'grow',
  'learn',
  'work',
  'find',
  'gain',
  'become',
  'see',
  'feel',
  'need',
]);

/**
 * Why a line with no heading section and no cue is not a requirement, or
 * null when it reads as one: a skill, tool, qualification, or a task the
 * person will do.
 */
export function descriptionReason(text: string): SetAsideReason | null {
  const trimmed = text.trim();
  // "Northgate Logistics Partners, Columbus, OH (hybrid, 3 days on site)": where, not what.
  if (!/[.!?]$/.test(trimmed) && wordCount(trimmed) <= 16 && LOCATION_LINE.test(trimmed)) {
    return 'header-line';
  }
  if (ROLE_SUMMARY.test(trimmed)) return 'role-summary';
  const youWill = trimmed.match(YOU_WILL);
  if (youWill) {
    return NOT_DUTY_VERBS.has(youWill[1].toLowerCase())
      ? findVaguePhrases(trimmed).length > 0 || PITCH.test(trimmed) || /\bglue\b/i.test(trimmed)
        ? 'pitch'
        : 'description'
      : null;
  }
  if (PITCH.test(trimmed) || findVaguePhrases(trimmed).length > 0) {
    return REQUIREMENT_PHRASING.test(trimmed) ? null : 'pitch';
  }
  const subject = trimmed.match(NAMED_SUBJECT);
  if (subject) return JOB_TITLE_WORD.test(subject[0]) ? 'role-summary' : 'company-description';
  if (COMPANY_DESCRIPTION.test(trimmed)) return 'company-description';
  if (REQUIREMENT_PHRASING.test(trimmed)) return null;
  if (startsWithAction(trimmed)) return null;
  // A tool or credential ("Excel and SQL", "CPR certified") reads as a requirement; a capitalized name does not.
  if (extractRequirementTerms(trimmed).some((t) => t.shape === 'named' && t.source !== 'phrase'))
    return null;
  return 'description';
}

/** Words that make even a two-word line a qualification: "Spanish language skills", "CPR certified". */
const SHORT_QUALIFICATION =
  /\b(?:skills?|communication|certifi\w*|licen[cs]e[ds]?|card|fluen\w*|bilingual|languages?|proficien\w*|degree|diploma|ged|experience|knowledge|english|spanish|french|german|italian|portuguese|mandarin|chinese|cantonese|arabic|japanese|korean|vietnamese|tagalog|russian|hindi|polish|somali|haitian creole|asl|sign language)\b/i;

/**
 * True when a short line (under MIN_REQUIREMENT_WORDS) still names something
 * a person can have: a tool, a credential, a language, or a skill. "Python",
 * "CPR certified", and "Spanish language skills" are; "Remote", "Benefits",
 * and "Apply today" are not.
 */
export function isShortRequirement(text: string): boolean {
  const trimmed = cleanText(text);
  if (!trimmed) return false;
  if (
    isBoilerplate(trimmed) ||
    JOB_DETAIL_LINE.test(trimmed) ||
    APPLICATION_LOGISTICS.test(trimmed)
  )
    return false;
  if (SHORT_QUALIFICATION.test(trimmed)) return true;
  return descriptionReason(trimmed) === null;
}

/** A line to flag as possible noise: short, and naming nothing a person can have. */
export function looksLikeNoise(text: string): boolean {
  return wordCount(text) < MIN_REQUIREMENT_WORDS && !isShortRequirement(text);
}

/** "Location: Austin, TX", "$17 to $19 per hour", "Apply by October 1": facts about the job, not requirements. */
function isJobDetail(text: string): boolean {
  if (JOB_DETAIL_LINE.test(text)) return true;
  if (!JOB_DETAIL_SENTENCE.test(text)) return false;
  const cues = findCues(text);
  return !(cues.required || cues.preferred || cues.responsibility);
}

/** Lines longer than this are paragraphs, where semicolons separate sentences. */
const LONG_LINE_WORDS = 30;

function headingText(text: string): string {
  return text.replace(/[:\s]+$/, '').trim();
}

class PostingParser {
  private readonly requirements: PostingRequirement[] = [];
  private readonly headings: PostingHeading[] = [];
  private readonly setAside: SetAsideLine[] = [];
  private overLimitCount = 0;
  private context: SectionContext | null = null;
  /** True once a list item was read under the current heading. */
  private listSeen = false;

  constructor(
    private readonly raw: string,
    private readonly max: number
  ) {}

  run(): Omit<ParsedPosting, 'vaguePhrases' | 'titles'> {
    const lines = scanPostingLines(this.raw);
    for (let i = 0; i < lines.length; i++) {
      const parent = lines[i];
      // A section ends at a blank line followed by prose: "Application closes
      // November 13." after the Preferred list is not a preferred qualification.
      const previous = lines[i - 1];
      const blankBefore =
        previous !== undefined && /\n[^\S\n]*\n/.test(this.raw.slice(previous.end, parent.start));
      if (blankBefore && parent.marker === null && this.listSeen) {
        this.context = null;
        this.listSeen = false;
      }
      if (parent.marker !== null && this.context !== null) this.listSeen = true;
      let j = i + 1;
      while (parent.marker && j < lines.length && isNestedUnder(lines[j], parent)) j++;
      if (j > i + 1) {
        this.group(parent, lines.slice(i + 1, j));
        i = j - 1;
      } else {
        this.line(parent);
      }
    }
    return {
      text: this.raw,
      requirements: this.requirements,
      headings: this.headings,
      setAside: this.setAside.sort((a, b) => a.start - b.start),
      overLimitCount: this.overLimitCount,
    };
  }

  private skip(span: SourceSpan, reason: SetAsideReason): void {
    this.setAside.push({
      start: span.start,
      end: span.end,
      text: this.raw.slice(span.start, span.end),
      reason,
    });
  }

  /** Records a heading and makes it the context for what follows. Returns false if the line is not one. */
  private heading(line: ScannedLine): boolean {
    const meaning = headingMeaning(line.text);
    const cues = findCues(line.text);
    // "MUST BE 18 OR OLDER" is short and in capitals, but it is a requirement.
    // So is "• SQL" in a requirements list: an acronym, not a heading.
    const capitals = !(line.marker !== null && isClassifiedContext(this.context));
    const legacyHeading =
      isSectionHeader(line.text, { capitals }) &&
      !inlineHeading(line.text) &&
      !(cues.required || cues.preferred || cues.responsibility);
    if (meaning === null && !legacyHeading) return false;
    const text = headingText(line.text);
    const resolved = meaning ?? 'neutral';
    this.context = { meaning: resolved, heading: text };
    this.listSeen = false;
    this.headings.push({ start: line.start, end: line.end, text, meaning: resolved });
    this.skip(line, 'heading');
    return true;
  }

  private line(line: ScannedLine): void {
    if (JOB_DETAIL_LINE.test(line.text)) {
      this.skip(line, 'job-details');
      return;
    }
    if (this.heading(line)) return;
    this.span(line, line.text, line.marker !== null);
  }

  /**
   * Processes a stretch of the raw text (one line, or a bullet plus its
   * wrapped lines). A short bullet under a requirement heading ("Excel") is
   * kept, and so is a short line that says it is required ("Must know SQL.")
   * when the paste lost its bullets. A short unmarked line with no such cue
   * ("Remote") never is.
   */
  private span(span: SourceSpan, firstLine: string, marked: boolean): void {
    if (this.context?.meaning === 'set-aside' && !inlineHeading(firstLine)) {
      this.skip(span, 'outside-requirements');
      return;
    }
    const cues = findCues(this.raw.slice(span.start, span.end));
    const shortAllowed =
      isClassifiedContext(this.context) && (marked || !!cues.required || !!cues.preferred);
    if (!shortAllowed && !inlineHeading(firstLine)) {
      const verdict = classifyLegacyLine(cleanText(this.raw.slice(span.start, span.end)));
      if (verdict === 'too-short' || verdict === 'header-line') {
        this.skip(span, verdict);
        return;
      }
    }
    const minWords = shortAllowed ? 2 : MIN_REQUIREMENT_WORDS;
    // Semicolons only separate sentences in paragraphs; in a bullet,
    // "No experience required; we will train you" is one thought.
    const splitOnSemicolon = wordCount(this.raw.slice(span.start, span.end)) > LONG_LINE_WORDS;
    const sentences = mergeShortSegments(
      this.raw,
      splitSentences(this.raw, span.start, span.end, splitOnSemicolon),
      minWords
    );
    for (const sentence of sentences) this.sentence(sentence, shortAllowed);
  }

  private sentence(segment: TextSegment, shortAllowed: boolean): void {
    let { start } = segment;
    let text = segment.text;
    const label = inlineHeading(text);
    if (label) {
      this.context = { meaning: label.meaning, heading: label.heading };
      this.headings.push({
        start,
        end: start + label.heading.length,
        text: label.heading,
        meaning: label.meaning,
      });
      start += label.restOffset;
      text = this.raw.slice(start, segment.end);
    }
    const span = { start, end: segment.end };
    if (this.context?.meaning === 'set-aside') {
      this.skip(span, 'outside-requirements');
      return;
    }
    if (isBoilerplate(text)) {
      this.skip(span, 'boilerplate');
      return;
    }
    if (isJobDetail(text)) {
      this.skip(span, 'job-details');
      return;
    }
    if (APPLICATION_LOGISTICS.test(text)) {
      this.skip(span, 'application-logistics');
      return;
    }
    const words = wordCount(text);
    const allowShort = shortAllowed && isClassifiedContext(this.context);
    if (words === 0 || (!allowShort && words < MIN_REQUIREMENT_WORDS)) {
      this.skip(span, 'too-short');
      return;
    }
    const classification = decideSection(this.context, findCues(text));
    if (classification.section === 'unclassified' && classification.basis === 'none') {
      const reason = descriptionReason(cleanText(text));
      if (reason) {
        this.skip(span, reason);
        return;
      }
    }
    this.push(span, cleanText(text), classification);
  }

  private push(span: SourceSpan, text: string, classification: SectionClassification): void {
    if (this.requirements.length >= this.max) {
      this.overLimitCount++;
      this.skip(span, 'over-limit');
      return;
    }
    this.requirements.push({
      id: parsedRequirementId(span),
      text,
      section: classification.section,
      status: 'suggested',
      origin: 'parsed',
      span,
      classification,
    });
  }

  /**
   * A bullet with lines nested under it. Unmarked nested lines are the
   * bullet's own text wrapped onto the next line. Marked nested lines are
   * sub-bullets: short ones ("Python", "R") are folded into the parent as one
   * requirement; long ones stand alone and inherit the parent's section.
   */
  private group(parent: ScannedLine, nested: ScannedLine[]): void {
    const firstItem = nested.findIndex((line) => line.marker !== null);
    const wrapped = firstItem === -1 ? nested : nested.slice(0, firstItem);
    const items = firstItem === -1 ? [] : nested.slice(firstItem);
    const leadEnd = wrapped.length > 0 ? wrapped[wrapped.length - 1].end : parent.end;
    const leadText = cleanText(this.raw.slice(parent.start, leadEnd));

    if (items.length === 0) {
      if (!this.heading(parent))
        this.span({ start: parent.start, end: leadEnd }, parent.text, true);
      return;
    }
    if (headingMeaning(leadText) !== null) {
      this.heading({ ...parent, text: leadText, end: leadEnd });
      for (const item of items) this.line(item);
      return;
    }

    const allLong = items.every((item) => wordCount(item.text) >= MIN_REQUIREMENT_WORDS);
    if (!allLong) {
      const lead = leadText.replace(/:\s*$/, '');
      const parts = items.map((item) => cleanText(item.text));
      const joiner = parts.some((p) => p.includes(',')) ? '; ' : ', ';
      const text = `${lead}: ${parts.join(joiner)}`;
      const span = { start: parent.start, end: items[items.length - 1].end };
      if (isBoilerplate(text)) {
        this.skip(span, 'boilerplate');
        return;
      }
      if (this.context?.meaning === 'set-aside') {
        this.skip(span, 'outside-requirements');
        return;
      }
      this.push(span, text, decideSection(this.context, findCues(text)));
      return;
    }

    const outer = this.context;
    let inherited: SectionClassification;
    if (/:\s*$/.test(leadText)) {
      inherited = decideSection(outer, findCues(leadText));
      this.skip({ start: parent.start, end: leadEnd }, 'group-lead');
    } else {
      const before = this.requirements.length;
      this.span({ start: parent.start, end: leadEnd }, parent.text, true);
      inherited =
        this.requirements.length > before
          ? (this.requirements[this.requirements.length - 1]
              .classification as SectionClassification)
          : decideSection(outer, findCues(leadText));
    }
    if (inherited.section !== 'unclassified') {
      this.context = { meaning: inherited.section, heading: headingText(leadText) };
    }
    for (const item of items) this.line(item);
    // A heading met inside the group stays in force; otherwise restore.
    if (this.context?.heading === headingText(leadText)) this.context = outer;
  }
}

/**
 * Splits a pasted posting into requirements with section types and source
 * spans, and lists everything it set aside. Headings ("Requirements", "Nice
 * to have", "What you'll do") and in-line cues ("must", "a plus",
 * "responsible for") decide the section; when they are absent or disagree
 * the requirement stays `unclassified` for the student to sort.
 */
export function parsePosting(rawText: string, options: ParseOptions = {}): ParsedPosting {
  const max = options.maxRequirements ?? MAX_REQUIREMENT_LINES;
  const parsed = new PostingParser(rawText, max).run();
  const titles = (options.lookup?.matchTitles?.(rawText) ?? []).filter(
    (hit) => hit.start >= 0 && hit.end <= rawText.length && hit.end > hit.start
  );
  return {
    ...parsed,
    vaguePhrases: findVaguePhrases(rawText),
    titles,
  };
}

/** The text a span covers, or null when the span does not fit the text (it was edited since). */
export function sliceSpan(text: string, span: SourceSpan | null | undefined): string | null {
  if (!span || span.start < 0 || span.end > text.length || span.end < span.start) return null;
  return text.slice(span.start, span.end);
}
