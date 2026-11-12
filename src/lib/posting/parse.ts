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
  | 'over-limit';

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
  /\$\s?\d|\b\d+\s*(?:(?:-|–|to)\s*\d+\s*)?hours\s+(?:per|a|each)\s+week\b|^apply\s+(?:by|before|online|through|via|at|now|today)\b|^to\s+apply\b/i;

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

  constructor(
    private readonly raw: string,
    private readonly max: number
  ) {}

  run(): Omit<ParsedPosting, 'vaguePhrases' | 'titles'> {
    const lines = scanPostingLines(this.raw);
    for (let i = 0; i < lines.length; i++) {
      const parent = lines[i];
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
    const legacyHeading =
      isSectionHeader(line.text) &&
      !inlineHeading(line.text) &&
      !(cues.required || cues.preferred || cues.responsibility);
    if (meaning === null && !legacyHeading) return false;
    const text = headingText(line.text);
    const resolved = meaning ?? 'neutral';
    this.context = { meaning: resolved, heading: text };
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
   * kept; a short unmarked line ("Remote") never is.
   */
  private span(span: SourceSpan, firstLine: string, marked: boolean): void {
    if (this.context?.meaning === 'set-aside' && !inlineHeading(firstLine)) {
      this.skip(span, 'outside-requirements');
      return;
    }
    const shortAllowed = marked && isClassifiedContext(this.context);
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
    const words = wordCount(text);
    const allowShort = shortAllowed && isClassifiedContext(this.context);
    if (words === 0 || (!allowShort && words < MIN_REQUIREMENT_WORDS)) {
      this.skip(span, 'too-short');
      return;
    }
    this.push(span, cleanText(text), decideSection(this.context, findCues(text)));
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
