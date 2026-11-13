/**
 * Section evidence: what a heading says about the lines under it, and what a
 * line says about itself. When the two disagree, or neither says anything,
 * the line stays unclassified. The engine never guesses.
 */

import type { PostingSection, SectionClassification } from './types';

/** What a heading tells us about the lines below it. */
export type HeadingMeaning =
  | Exclude<PostingSection, 'unclassified'>
  /** About the company, benefits, how to apply: not requirements at all. */
  | 'set-aside'
  /** A heading we do not read as any section ("Schedule", "Education"). */
  | 'neutral';

interface HeadingRule {
  meaning: HeadingMeaning;
  pattern: RegExp;
}

// Order matters: "preferred qualifications" must be read before "qualifications".
const HEADING_RULES: HeadingRule[] = [
  {
    meaning: 'preferred',
    pattern:
      /^(?:preferred|desired|desirable|bonus|additional\s+preferred)(?:\s+(?:qualifications|skills|experience|requirements|points?))?$|^nice[\s-]to[\s-]haves?$|^nice\s+if\s+you\s+have$|^(?:it.s\s+a\s+)?(?:big\s+)?plus(?:es)?(?:\s+if\s+you\s+have)?$|^bonus\s+points?(?:\s+if(?:\s+you\s+have)?)?$|^good\s+to\s+have$|^even\s+better\s+if(?:\s+you\s+have)?$|^extra\s+credit$|^ideally(?:,?\s+you(?:.ll)?\s+(?:also\s+)?have)?$|^what\s+would\s+make\s+you\s+stand\s+out$|^you\s+might\s+also\s+have$/,
  },
  {
    meaning: 'required',
    pattern:
      /^(?:minimum|basic|required|essential|key|job|position)\s+(?:qualifications|requirements|skills)$|^(?:requirements|qualifications|required|must[\s-]haves?|requirements\s+(?:and|&)\s+qualifications|qualifications\s+(?:and|&)\s+(?:requirements|skills|experience)|skills\s+(?:and|&)\s+(?:qualifications|experience|requirements)|what\s+you(?:.ll)?\s+need(?:\s+to\s+(?:have|succeed))?|what\s+you\s+(?:will\s+)?need|what\s+you(?:.ll)?\s+bring|what\s+you\s+bring(?:\s+to\s+the\s+(?:team|table|role))?|what\s+we.re\s+looking\s+for|what\s+we\s+are\s+looking\s+for|who\s+you\s+are|about\s+you|you\s+have|you\s+should\s+have|your\s+(?:profile|background|qualifications)|eligibility(?:\s+requirements)?|physical\s+requirements|to\s+be\s+considered|we.d\s+love\s+to\s+hear\s+from\s+you\s+if)$/,
  },
  {
    meaning: 'responsibility',
    pattern:
      /^(?:key|primary|main|core|job|essential|your|daily|general)?\s*(?:responsibilities|duties|functions)(?:\s+(?:and|&)\s+(?:responsibilities|duties))?$|^(?:essential|job)\s+(?:duties|functions)(?:\s+(?:and|&)\s+responsibilities)?$|^what\s+you(?:.ll|\s+will)\s+(?:do|be\s+doing|work\s+on|own)$|^what\s+you\s+will\s+do$|^(?:a\s+)?day[\s-](?:to[\s-]day|in\s+the\s+life)$|^in\s+this\s+role(?:,?\s+you\s+will)?$|^as\s+an?\s+[a-z\s]{2,30},?\s+you\s+will$|^your\s+(?:role|impact|day)$|^the\s+work$|^how\s+you.ll\s+(?:contribute|spend\s+your\s+time)$|^role\s+responsibilities$|^you\s+will$/,
  },
  {
    meaning: 'set-aside',
    pattern:
      /^(?:about\s+(?:us|the\s+company|[a-z0-9&.' ]{2,40})|who\s+we\s+are|our\s+(?:mission|values|story|culture|benefits|team|company)|benefits(?:\s+(?:and|&)\s+perks)?|perks(?:\s+(?:and|&)\s+benefits)?|what\s+we\s+offer|why\s+(?:join|work\s+(?:with|for|at))(?:\s+us)?|why\s+you.ll\s+love\s+(?:it|working\s+here)|compensation(?:\s+(?:and|&)\s+benefits)?|salary(?:\s+range)?|pay(?:\s+range)?|how\s+to\s+apply|application\s+process|to\s+apply|equal\s+opportunity(?:\s+employer)?(?:\s+statement)?|eeo(?:\s+statement)?|our\s+commitment\s+to\s+diversity|diversity(?:\s+(?:and|&)\s+inclusion)?)$/,
  },
];

/** Headings that name no section: lines below them are kept but left unclassified. */
const NEUTRAL_HEADINGS =
  /^(?:schedule|hours|work\s+schedule|shift\s+details|education(?:\s+(?:and|&)\s+experience)?|experience|skills|skills\s+(?:and|&)\s+abilities|knowledge,?\s+skills,?\s+(?:and|&)\s+abilities|physical\s+(?:demands|environment)|work(?:ing)?\s+(?:environment|conditions)|travel|certifications?|licenses?(?:\s+(?:and|&)\s+certifications?)?|training|supervision|(?:job|position)\s+(?:details|overview|summary|description|information)|details|overview|summary|description|additional\s+information|other\s+information|the\s+(?:role|opportunity|team|position|job)|role\s+overview|internship\s+details|program\s+details)$/;

const NEUTRAL_EXCEPTIONS =
  /^about\s+(?:the\s+|this\s+)?(?:role|job|position|opportunity|internship|program|team|department)$/;

/** Lowercase, drop list markers, trailing colons and punctuation, collapse spaces. */
function headingKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[:.\s]+$/, '')
    .replace(/^[#*\s]+|[*\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** What a heading line says about the lines under it, or null if it names no section we know. */
export function headingMeaning(text: string): HeadingMeaning | null {
  const key = headingKey(text);
  if (!key) return null;
  if (NEUTRAL_EXCEPTIONS.test(key) || NEUTRAL_HEADINGS.test(key)) return 'neutral';
  for (const rule of HEADING_RULES) {
    if (rule.pattern.test(key)) return rule.meaning;
  }
  return null;
}

/**
 * A heading folded into the start of a line: "Preferred: experience with
 * Figma" or "Responsibilities include greeting customers". Returns the
 * heading and where the rest of the line starts.
 */
export function inlineHeading(
  text: string
): { meaning: HeadingMeaning; heading: string; restOffset: number } | null {
  const labelled = text.match(/^([A-Za-z][A-Za-z'’&,\s-]{1,48}?)\s*[:–—]\s+(?=\S)/);
  if (labelled) {
    const meaning = headingMeaning(labelled[1]);
    if (meaning) return { meaning, heading: labelled[1].trim(), restOffset: labelled[0].length };
  }
  const includes = text.match(
    /^((?:key\s+|main\s+|primary\s+)?(?:responsibilities|duties|requirements|qualifications))\s+(?:include|includes|are)\s*:?\s+(?=\S)/i
  );
  if (includes) {
    const meaning = headingMeaning(includes[1]);
    if (meaning) return { meaning, heading: includes[1].trim(), restOffset: includes[0].length };
  }
  return null;
}

// ============================================================================
// In-line cues
// ============================================================================

/** Phrases where "required" or "needed" describes a duty's timing, not a qualification. */
const DUTY_TIMING = /\b(?:as|when|where|if)\s+(?:required|needed|assigned|directed|necessary)\b/g;

/** "No experience required", "degree not required": the opposite of a requirement. */
const NEGATED_REQUIRED =
  /\b(?:no(?:\s+[\w'-]+){0,3}?|not|never)\s+(?:is\s+|are\s+)?(?:required|necessary|needed|mandatory|a\s+requirement)\b/g;

const REQUIRED_CUES =
  /\bmust\b|\brequired\b|\brequires?\b|\bmandatory\b|\byou(?:'ll|\s+will)?\s+need\b|\bneed\s+to\s+(?:have|be)\b|\bminimum\s+(?:of\s+)?(?:\d|one|two|three)\b/;

const PREFERRED_CUES =
  /\bpreferred\b|\bpreferably\b|\bideally\b|\bnice[\s-]to[\s-]have\b|\b(?:is|are|would\s+be|a)\s+(?:big\s+|huge\s+|definite\s+)?plus\b|\bplus\s+if\b|\bbonus\s+(?:points?|if)\b|\b(?:is|are|would\s+be)\s+a\s+bonus\b|\bdesired\b|\bdesirable\b|\badvantageous\b|\b(?:is|are|would\s+be)\s+an\s+advantage\b|\bhelpful\b|\bgood\s+to\s+have\b|\beven\s+better\s+if\b|\bnot\s+required\s+but\b/;

const RESPONSIBILITY_CUES =
  /\bresponsible\s+for\b|\b(?:duties|responsibilities)\s+(?:will\s+)?include\b|\byour\s+(?:main\s+|primary\s+|key\s+|daily\s+)?(?:duties|responsibilities)\b|\byou\s+will\s+be\s+(?:responsible|tasked)\b|\bday[\s-]to[\s-]day\s+(?:you|tasks)\b/;

export interface LineCues {
  required?: string;
  preferred?: string;
  responsibility?: string;
  /** A negated requirement ("no experience required"), kept so the interface can explain the line. */
  negated?: string;
}

/** The section cues a sentence carries in its own words. */
export function findCues(text: string): LineCues {
  const lower = text.toLowerCase().replace(/[‘’]/g, "'");
  const cues: LineCues = {};
  const negated = lower.match(NEGATED_REQUIRED);
  if (negated) cues.negated = negated[0];
  // Blank out timing phrases and negations so their "required" is not read as a cue.
  const cleaned = lower.replace(DUTY_TIMING, ' ').replace(NEGATED_REQUIRED, ' ');
  const preferred = lower.match(PREFERRED_CUES);
  if (preferred) cues.preferred = preferred[0];
  const required = cleaned.match(REQUIRED_CUES);
  if (required) cues.required = required[0];
  const responsibility = cleaned.match(RESPONSIBILITY_CUES);
  if (responsibility) cues.responsibility = responsibility[0];
  return cues;
}

export interface SectionContext {
  meaning: HeadingMeaning;
  heading: string;
}

/**
 * Combines the heading a line sits under with its own cues.
 *
 * - A preferred cue ("a plus") wins over a requirements heading, because
 *   postings routinely mark optional items inside the requirements list.
 * - A required cue under a responsibilities or preferred heading is a
 *   disagreement ("must greet customers" may be a duty or a condition), so
 *   the line is left for the student.
 * - Required and preferred cues in one sentence ("degree required, master's
 *   preferred") are a disagreement too.
 * - No cue and no section heading: unclassified.
 */
export function decideSection(
  context: SectionContext | null,
  cues: LineCues
): SectionClassification {
  const headingSection =
    context &&
    (context.meaning === 'required' ||
      context.meaning === 'preferred' ||
      context.meaning === 'responsibility')
      ? context.meaning
      : null;
  const heading = context?.heading;
  const withHeading = (c: SectionClassification): SectionClassification =>
    heading ? { ...c, heading } : c;

  const cueSections: [Exclude<PostingSection, 'unclassified'>, string][] = [];
  if (cues.required) cueSections.push(['required', cues.required]);
  if (cues.preferred) cueSections.push(['preferred', cues.preferred]);
  if (cues.responsibility) cueSections.push(['responsibility', cues.responsibility]);

  // "Helpful but not required", "required, preferred": a preferred cue next to
  // a required cue only agrees when the required cue was the negated one.
  if (cueSections.length > 1) {
    return withHeading({
      section: 'unclassified',
      basis: 'conflict',
      cue: cueSections.map(([, cue]) => cue).join(', '),
    });
  }

  if (cueSections.length === 1) {
    const [section, cue] = cueSections[0];
    if (!headingSection || headingSection === section) {
      return withHeading({
        section,
        basis: headingSection ? 'heading-and-cue' : 'cue',
        cue,
      });
    }
    if (section === 'preferred' && headingSection === 'required') {
      return withHeading({ section: 'preferred', basis: 'cue', cue });
    }
    return withHeading({ section: 'unclassified', basis: 'conflict', cue });
  }

  // "No experience required" is information, not a requirement, whatever
  // heading it sits under.
  if (cues.negated) {
    return withHeading({
      section: 'unclassified',
      basis: headingSection ? 'conflict' : 'none',
      cue: cues.negated,
    });
  }

  if (headingSection) return withHeading({ section: headingSection, basis: 'heading' });
  return withHeading({ section: 'unclassified', basis: 'none' });
}
