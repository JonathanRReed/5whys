import type { ResumeDoc, ResumeLine } from './types';

const GLYPH_PREFIX = /^\s*[-–•*◦○●▪·]\s+/;

/**
 * Join the visual lines of one paragraph with a space. A word split at a
 * line-end hyphen ("back-of-" then "house") is rejoined without the space,
 * keeping the hyphen, because a resume's compounds are written that way.
 */
function joinParts(parts: string[]): string {
  let text = '';
  for (const raw of parts) {
    const part = raw.trim();
    if (!part) continue;
    if (!text) text = part;
    else if (/[A-Za-z]-$/.test(text) && /^[a-z]/.test(part)) text += part;
    else text += ` ${part}`;
  }
  return text;
}

/** The right edge of the text column a line belongs to on its page. */
function columnRight(doc: ResumeDoc, line: ResumeLine): number {
  const box = line.box;
  if (!box) return 0;
  let right = box.x + box.width;
  for (const other of doc.lines) {
    if (other.pageIndex !== line.pageIndex || !other.box) continue;
    if (Math.abs(other.box.x - box.x) <= 2) right = Math.max(right, other.box.x + other.box.width);
  }
  return right;
}

/**
 * A PDF line that wraps onto the next visual line, by the same test the
 * engine uses for paragraphs: same left edge, the line above runs close
 * enough to the column's right edge that the next word could not fit, a
 * close baseline, and a lowercase start. Applied
 * here also where the engine kept the lines apart (after a semicolon, or
 * when indentation marked the wrapped line as a bullet of its own).
 */
function wrapsOnto(doc: ResumeDoc, above: ResumeLine, line: ResumeLine): boolean {
  if (doc.source !== 'pdf' || !above.box || !line.box) return false;
  if (above.pageIndex !== line.pageIndex) return false;
  if (!/^[\p{Ll}\d]/u.test(line.text.trim())) return false;
  if (/[.!?]["')\]]?\s*$/.test(above.text)) return false;
  if (Math.abs(above.box.x - line.box.x) > 2) return false;
  const size = line.fontSize ?? above.fontSize ?? 10;
  const gap = line.box.y - above.box.y - above.box.height;
  if (gap < -1 || gap > size * 0.8) return false;
  const right = columnRight(doc, above);
  // The line above wrapped if the next line's first word could not have fit
  // in the space left on it.
  const charWidth = line.box.width / Math.max(1, line.text.length);
  const firstWord = line.text.trim().split(/\s+/)[0] ?? '';
  const slack = Math.max(
    size * 2,
    (right - above.box.x) * 0.12,
    (firstWord.length + 1) * charWidth * 1.1
  );
  return right - (above.box.x + above.box.width) <= slack;
}

/**
 * The text to place in the resume editor after an upload: one paragraph per
 * line in reading order, each bullet prefixed with "- ", and wrapped
 * continuation lines joined to the line they continue. Scoring then sees
 * whole bullets instead of the way the file happened to wrap.
 */
export function toEditorText(doc: ResumeDoc): string {
  const byId = new Map(doc.lines.map((line) => [line.id, line]));
  const ordered =
    doc.geometricOrder.length === doc.lines.length
      ? doc.geometricOrder
          .map((id) => byId.get(id))
          .filter((line): line is ResumeLine => line !== undefined)
      : doc.lines;
  const continuations = new Map<string, ResumeLine[]>();
  for (const line of ordered) {
    if (!line.continuationOf || !byId.has(line.continuationOf)) continue;
    const group = continuations.get(line.continuationOf) ?? [];
    group.push(line);
    continuations.set(line.continuationOf, group);
  }
  const paragraphs: Array<{ text: string; bullet: boolean; last: ResumeLine }> = [];
  for (const line of ordered) {
    if (line.continuationOf && byId.has(line.continuationOf)) continue;
    const parts = [line, ...(continuations.get(line.id) ?? [])];
    const text = joinParts(parts.map((part) => part.text)).replace(GLYPH_PREFIX, '');
    if (!text) continue;
    const last = parts[parts.length - 1];
    const previous = paragraphs[paragraphs.length - 1];
    if (previous && wrapsOnto(doc, previous.last, line)) {
      previous.text = joinParts([previous.text, text]);
      previous.last = last;
    } else paragraphs.push({ text, bullet: line.bullet, last });
  }
  return paragraphs
    .map((paragraph) => (paragraph.bullet ? `- ${paragraph.text}` : paragraph.text))
    .join('\n');
}
