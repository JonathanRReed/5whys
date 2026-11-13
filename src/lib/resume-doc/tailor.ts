/**
 * The copy of a resume tailored for one application: which job each line is
 * under, where a bullet written on the Application Desk goes, and which lines
 * would say the same thing twice. Everything here reads the resume as the
 * exported file has it (see `copyLines`), so what the desk says about the
 * copy is what the file holds.
 */
import { cleanCopy, copyLines, isTitleLine, lineKey, rewrittenLines } from './export';
import { logicalLines } from './layout';
import { contactLineIds } from './repairs';
import type { ExportOptions, PrintParagraph, ResumeDoc, SectionKind } from './types';

/** A line reduced to its words, to match a rewrite to the line it replaces. */
export function wordsOf(text: string): string {
  return text
    .replace(/^\s*[-–•*◦○●▪·o]\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * A pasted resume often has no bullet marks. The lines the Resume Game reads
 * as achievements are its bullets, so they can be chosen here too.
 */
export function withAchievementLines(doc: ResumeDoc, achievements: readonly string[]): ResumeDoc {
  const found = new Set(achievements.map(wordsOf));
  if (found.size === 0) return doc;
  return {
    ...doc,
    lines: doc.lines.map((line) =>
      !line.bullet && !line.continuationOf && found.has(wordsOf(line.text))
        ? { ...line, bullet: true }
        : line
    ),
  };
}

/** A job, club role, or project: a place a bullet can go. */
export type ResumeRole = {
  /** The id of its first title line, or of its section heading when it has none. */
  id: string;
  /** How the resume names it: "Cashier, Valley Fresh Market, Aug 2023 - Present". */
  label: string;
  /** Its bullets, by the id of each one's first line. */
  bulletIds: string[];
  /** The last line under it in the copy: a new bullet goes after this one. */
  lastLineId: string;
};

/** Sections whose entries are things done, where a new bullet can go. */
const WORK: ReadonlySet<SectionKind> = new Set(['experience', 'projects', 'activities', 'other']);

/**
 * The jobs and roles in a resume, in the order the copy has them. A role
 * starts at a title line (dated, or a short line with bullets under it) in a
 * work section. Two title lines in a row ("Valley Fresh Market", then
 * "Cashier, 2023 - Present") are one role. Bullets under a work heading
 * with no title line belong to that section. Education, skills and a
 * summary hold no roles, so a bullet is never placed under them.
 */
export function resumeRoles(doc: ResumeDoc): ResumeRole[] {
  const copy = cleanCopy(doc);
  const lines = logicalLines(copy.lines);
  const sectionOf = new Map<string, (typeof copy.sections)[number]>();
  for (const section of copy.sections) {
    for (const id of section.lineIds) sectionOf.set(id, section);
  }
  const headings = new Set(copy.sections.map((section) => section.headingLineId));
  const headingText = new Map(lines.map((line) => [line.id, line.text]));
  const contact = contactLineIds(copy);
  // A resume with no headings at all: every line may be under a job.
  const anywhere = copy.sections.length === 0;
  const roles: ResumeRole[] = [];
  let current: ResumeRole | null = null;
  lines.forEach((line, index) => {
    if (headings.has(line.id)) {
      current = null;
      return;
    }
    const section = sectionOf.get(line.id);
    if (!anywhere && (!section || !WORK.has(section.kind))) {
      current = null;
      return;
    }
    if (contact.has(line.id) || index === 0) return;
    if (line.bullet) {
      if (!current) {
        if (!section) return;
        current = {
          id: section.headingLineId,
          label: (headingText.get(section.headingLineId) ?? '').trim(),
          bulletIds: [],
          lastLineId: line.id,
        };
        roles.push(current);
      }
      current.bulletIds.push(line.id);
      current.lastLineId = line.id;
      return;
    }
    if (isTitleLine(line.text, lines[index + 1]?.bullet ?? false)) {
      if (current && current.bulletIds.length === 0 && current.id !== section?.headingLineId) {
        current.label = `${current.label}, ${line.text.trim()}`;
        current.lastLineId = line.id;
        return;
      }
      current = { id: line.id, label: line.text.trim(), bulletIds: [], lastLineId: line.id };
      roles.push(current);
      return;
    }
    // A line of description under a role is part of it.
    if (current) current.lastLineId = line.id;
  });
  return roles;
}

/** The role a line is in, by the line's id or the role's own id. */
export function roleOf(roles: readonly ResumeRole[], lineId: string): ResumeRole | null {
  return (
    roles.find((role) => role.id === lineId || role.bulletIds.includes(lineId)) ??
    roles.find((role) => role.lastLineId === lineId) ??
    null
  );
}

const MONTHS =
  /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)$/;
const STOP = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'into',
  'that',
  'this',
  'their',
  'them',
  'they',
  'was',
  'were',
  'are',
  'our',
  'your',
  'you',
  'his',
  'her',
  'its',
  'each',
  'every',
  'all',
  'any',
  'but',
  'not',
  'who',
  'what',
  'when',
  'where',
  'which',
  'while',
  'than',
  'then',
  'there',
  'over',
  'under',
  'about',
  'after',
  'before',
  'per',
  'via',
  'present',
  'current',
  'now',
  'also',
  'other',
  'more',
  'most',
  'some',
  'had',
  'has',
  'have',
  'did',
  'got',
  'out',
  'off',
  'one',
  'two',
]);

/** A word reduced to its stem, so "registers" and "register" are one word. */
function stem(word: string): string {
  for (const ending of ['ing', 'ed', 'es', 's', 'e']) {
    if (word.endsWith(ending) && word.length - ending.length >= 4) {
      return word.slice(0, -ending.length);
    }
  }
  return word;
}

/** The words of a line that carry its meaning, stemmed. */
function contentWords(text: string): Set<string> {
  return new Set(
    (text.toLowerCase().match(/[\p{L}][\p{L}'-]*/gu) ?? [])
      .map((word) => word.replace(/'s$/, ''))
      .filter((word) => word.length >= 3 && !STOP.has(word) && !MONTHS.test(word))
      .map(stem)
  );
}

/**
 * The role a written bullet most likely belongs to, by the words of the
 * role's title it repeats: "Tracked the Business Club budget" names the
 * role "Treasurer, Business Club". Only a word that no other role's title
 * has counts, and only one role may match; otherwise this is null and the
 * visitor chooses.
 */
export function guessRole(
  text: string,
  roles: readonly ResumeRole[]
): { role: ResumeRole; words: string[] } | null {
  if (roles.length === 0) return null;
  const said = contentWords(text);
  const titles = roles.map((role) => contentWords(role.label));
  const counts = new Map<string, number>();
  for (const words of titles)
    for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  const hits = roles
    .map((role, index) => ({
      role,
      words: [...titles[index]].filter((word) => counts.get(word) === 1 && said.has(word)),
    }))
    .filter((hit) => hit.words.length > 0);
  if (hits.length !== 1) return null;
  // The words as the role's title writes them, for telling the visitor why.
  const written = (hits[0].role.label.match(/[\p{L}][\p{L}'-]*/gu) ?? []).filter((word) =>
    hits[0].words.includes(stem(word.toLowerCase().replace(/'s$/, '')))
  );
  return { role: hits[0].role, words: [...new Set(written)] };
}

/**
 * Whether two bullets describe the same work: at least three meaningful
 * words in common, making up at least two fifths of the shorter line.
 * "Balanced my register drawer at close" and "Counted the drawer at close,
 * so the register balanced" do.
 */
export function sameWork(a: string, b: string): boolean {
  if (lineKey(a) === lineKey(b)) return true;
  const left = contentWords(a);
  const right = contentWords(b);
  const smaller = Math.min(left.size, right.size);
  if (smaller === 0) return false;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared >= 3 && shared / smaller >= 0.4;
}

/** A bullet added on the desk that says the same as another bullet in the copy. */
export type RepeatedLine = {
  /** The added bullet's paragraph id (`added-<n>`). */
  addedId: string;
  /** The other paragraph: a resume line's id, or another `added-<n>`. */
  otherId: string;
  otherText: string;
};

/**
 * Bullets written on the desk that repeat a bullet already in the copy, read
 * from the copy itself, so only lines that will really be in the file count.
 * Two lines of the resume itself are the visitor's own choice and are not
 * reported here.
 */
export function repeatedLines(paragraphs: readonly PrintParagraph[]): RepeatedLine[] {
  const bullets = paragraphs.filter((paragraph) => paragraph.kind === 'bullet');
  const isAdded = (id: string) => /^added-\d+$/.test(id);
  const found: RepeatedLine[] = [];
  bullets.forEach((paragraph, index) => {
    if (!isAdded(paragraph.lineId)) return;
    for (const [otherIndex, other] of bullets.entries()) {
      if (otherIndex === index) continue;
      // Two desk bullets: reported once, on the later one.
      if (isAdded(other.lineId) && otherIndex > index) continue;
      if (sameWork(paragraph.text, other.text)) {
        found.push({ addedId: paragraph.lineId, otherId: other.lineId, otherText: other.text });
        return;
      }
    }
  });
  return found;
}

/**
 * Rewrites that can be placed on exactly one line. One saved without the
 * line it came from (no `occurrence`) whose words appear on more than one
 * line of the copy cannot be: putting it on the first would put it under
 * the wrong job when the visitor rewrote a later one. Those are returned in
 * `unplaced` and left out of the copy, which keeps that line as written.
 */
export function placeableRewrites<
  T extends { original: string; improved: string; occurrence?: number },
>(doc: ResumeDoc, rewrites: readonly T[]): { rewrites: T[]; unplaced: T[] } {
  const counts = new Map<string, number>();
  for (const line of logicalLines(cleanCopy(doc).lines)) {
    const key = lineKey(line.text);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const placeable: T[] = [];
  const unplaced: T[] = [];
  for (const rewrite of rewrites) {
    const ambiguous =
      rewrite.occurrence === undefined && (counts.get(lineKey(rewrite.original)) ?? 0) > 1;
    (ambiguous ? unplaced : placeable).push(rewrite);
  }
  return { rewrites: placeable, unplaced };
}

/** Where a bullet written on the desk goes in the copy, and why. */
export type Placement =
  | { kind: 'chosen'; role: ResumeRole; afterLineId: string }
  | { kind: 'only'; role: ResumeRole; afterLineId: string }
  | { kind: 'guessed'; role: ResumeRole; afterLineId: string; words: string[] }
  | { kind: 'new-section' }
  | { kind: 'unplaced' };

/**
 * The place of a desk bullet. `saved` is what the visitor chose: a role's
 * id (after its last line) or a bullet's id (right after that bullet, or in
 * its place when that bullet is left out). With nothing chosen: the only
 * role there is, the role the bullet names, a section of its own when the
 * resume has no role yet, and otherwise no place until the visitor picks one.
 * A saved place that is no longer in the resume is no place.
 */
export function placeBullet(
  text: string,
  saved: string | null,
  roles: readonly ResumeRole[]
): Placement {
  if (saved) {
    const role = roleOf(roles, saved);
    if (role) {
      return {
        kind: 'chosen',
        role,
        afterLineId: saved === role.id ? role.lastLineId : saved,
      };
    }
    return roles.length === 0 ? { kind: 'new-section' } : { kind: 'unplaced' };
  }
  if (roles.length === 0) return { kind: 'new-section' };
  if (roles.length === 1) return { kind: 'only', role: roles[0], afterLineId: roles[0].lastLineId };
  const guess = guessRole(text, roles);
  if (guess) {
    return {
      kind: 'guessed',
      role: guess.role,
      afterLineId: guess.role.lastLineId,
      words: guess.words,
    };
  }
  return { kind: 'unplaced' };
}

/** The bullets to add to the copy, in the form the exporter takes. */
export function addedBulletsFor(
  bullets: readonly { text: string; placement: Placement }[]
): NonNullable<ExportOptions['addedBullets']> {
  return bullets.flatMap(({ text, placement }) => {
    if (placement.kind === 'unplaced') return [];
    // An id no line has: the exporter puts it under the loose heading.
    if (placement.kind === 'new-section') return [{ afterLineId: '', text }];
    return [{ afterLineId: placement.afterLineId, text }];
  });
}

/**
 * The bullets of a resume grouped under the job each is in, with the wording
 * the visitor rewrote them to, for starting a new bullet from one of them.
 * `achievements` are the lines the Resume Game reads as bullets.
 */
export function bulletsByRole(
  doc: ResumeDoc,
  rewrites: readonly { original: string; improved: string; occurrence?: number }[]
): { label: string; lines: string[] }[] {
  const wording = rewrittenLines(doc, placeableRewrites(doc, rewrites).rewrites);
  const text = new Map(copyLines(doc).map((line) => [line.id, line.text]));
  return resumeRoles(doc)
    .map((role) => ({
      label: role.label,
      lines: role.bulletIds
        .map((id) =>
          (wording.get(id) ?? text.get(id) ?? '').replace(/^\s*[-–•*◦○●▪·]\s*/, '').trim()
        )
        .filter(Boolean),
    }))
    .filter((group) => group.lines.length > 0);
}
