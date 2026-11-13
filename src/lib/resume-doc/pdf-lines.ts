import { datesIn } from './dates';
import { logicalLines, pageColumns } from './layout';
import { headingKind, parseContact } from './model';
import type { ResumeDoc, ResumeLine, SectionKind } from './types';

const GLYPH = /^[-–•◦○●▪*·o]$/;
const PREFIX = /^\s*(?:[•◦○●▪·]\s*|[-–*o]\s+)/;

function isDateLine(text: string): boolean {
  return (
    datesIn(text).some((date) => date.index === 0) ||
    /^(?:(?:19|20)\d{2}|present|current)\b/i.test(text)
  );
}

function isHeading(line: ResumeLine): boolean {
  return !!headingKind(line.text) || /^[A-Z][A-Z\s&/]+$/.test(line.text.trim());
}

function isContact(line: ResumeLine): boolean {
  const contact = parseContact([line]);
  return !!(contact.email || contact.phone || contact.links.length);
}

/** Recover list markers even when the content stream places them after their text. */
function markGlyphs(doc: ResumeDoc): void {
  const markers = new Set<ResumeLine>();
  for (const line of doc.lines) {
    // A glyph alone on its line is a marker for the text beside it; the pass
    // below attaches it. Stripping it here would leave an empty bullet.
    if (GLYPH.test(line.text.trim())) continue;
    const prefix = line.text.match(PREFIX);
    if (prefix) {
      line.text = line.text.slice(prefix[0].length);
      line.bullet = true;
    }
  }
  for (const marker of doc.lines) {
    if (!marker.box || !GLYPH.test(marker.text.trim())) continue;
    const box = marker.box;
    const target = doc.lines
      .filter((line) => {
        if (line === marker || line.pageIndex !== marker.pageIndex || !line.box) return false;
        const size = line.fontSize ?? 10;
        const gap = line.box.x - (box.x + box.width);
        return (
          !GLYPH.test(line.text.trim()) &&
          Math.abs(line.box.y + line.box.height - box.y - box.height) <= size * 0.4 &&
          gap >= -1 &&
          gap <= size * 2.5
        );
      })
      .sort((a, b) => (a.box?.x ?? 0) - (b.box?.x ?? 0))[0];
    if (!target) continue;
    target.bullet = true;
    target.items.push(...marker.items);
    markers.add(marker);
  }
  // A marker that found its text is folded into it. One that found none is
  // decoration, not a line of the resume.
  doc.lines = doc.lines.filter(
    (line) => !markers.has(line) && !/^[•◦○●▪·]$/.test(line.text.trim())
  );
}

function groupContinuations(lines: ResumeLine[]): void {
  const rightEdge = Math.max(...lines.map((line) => (line.box?.x ?? 0) + (line.box?.width ?? 0)));
  let previous: ResumeLine | undefined;
  let root: ResumeLine | undefined;
  let inSection = false;
  for (const line of lines) {
    const before = previous;
    if (headingKind(line.text)) inSection = true;
    const box = line.box;
    const oldBox = before?.box;
    const size = line.fontSize ?? 10;
    const indent = box && oldBox ? box.x - oldBox.x : 0;
    const gap = box && oldBox ? box.y - oldBox.y - oldBox.height : 0;
    const sameFont =
      before?.fontName === line.fontName && Math.abs((before.fontSize ?? 0) - size) <= 1;
    if (
      inSection &&
      before &&
      root &&
      box &&
      oldBox &&
      sameFont &&
      !line.bullet &&
      !isHeading(line) &&
      !isHeading(before) &&
      !isDateLine(line.text) &&
      !isDateLine(before.text) &&
      !isContact(line) &&
      !isContact(before) &&
      !/[.!?:;]["')\]]?\s*$/.test(before.text) &&
      before.text.trim().length >= 24 &&
      // Require a nearly full line and a close baseline, not just nearby paragraphs.
      rightEdge - oldBox.x - oldBox.width <= Math.max(size * 2, (rightEdge - oldBox.x) * 0.12) &&
      gap >= -1 &&
      gap <= size * 0.65 &&
      (Math.abs(indent) <= 2 || (root.bullet && indent > 0 && indent <= size * 2)) &&
      // A new action or entry usually starts with a capital. Leave ambiguous joins alone.
      /^[\p{Ll}\d]/u.test(line.text.trim())
    ) {
      line.continuationOf = root.id;
    } else root = line;
    previous = line;
  }
}

function markIndentedBullets(lines: ResumeLine[]): void {
  const paragraphs = logicalLines(lines);
  const byId = new Map(lines.map((line) => [line.id, line]));
  const lastParts = new Map<string, ResumeLine>();
  for (const line of lines) {
    if (line.continuationOf) lastParts.set(line.continuationOf, line);
  }
  let section: SectionKind | null = null;
  let entry: ResumeLine | undefined;
  for (let index = 0; index < paragraphs.length; index += 1) {
    const line = paragraphs[index];
    const kind = headingKind(line.text);
    if (kind) {
      section = kind;
      entry = undefined;
      continue;
    }
    if (!['experience', 'projects', 'activities'].includes(section ?? '') || !line.box) continue;
    if (isDateLine(line.text) || isContact(line)) continue;
    const size = line.fontSize ?? 10;
    const indent = entry?.box ? line.box.x - entry.box.x : 0;
    if (!entry || indent < 6 || indent > size * 4) {
      if (!line.bullet) entry = line;
      continue;
    }
    const run = [line];
    for (let next = index + 1; next < paragraphs.length; next += 1) {
      const candidate = paragraphs[next];
      const last = run[run.length - 1];
      const lastPart = lastParts.get(last.id) ?? last;
      if (
        !candidate.box ||
        !lastPart.box ||
        Math.abs(candidate.box.x - line.box.x) > 2 ||
        candidate.box.y - lastPart.box.y - lastPart.box.height > size * 2 ||
        candidate.box.y <= lastPart.box.y ||
        isHeading(candidate) ||
        isDateLine(candidate.text) ||
        isContact(candidate)
      )
        break;
      run.push(candidate);
    }
    if (run.length < 2 || line.box.y - (entry.box?.y ?? 0) > size * 6) continue;
    for (const paragraph of run) {
      const original = byId.get(paragraph.id);
      if (original) original.bullet = true;
    }
    index += run.length - 1;
  }
}

/** Runs only on imported PDF geometry, never on a visitor's edited structured copy. */
export function normalizePdfLines(doc: ResumeDoc): ResumeDoc {
  markGlyphs(doc);
  for (const page of doc.pages) {
    for (const lines of pageColumns(doc, page.index)) {
      if (!lines.length) continue;
      groupContinuations(lines);
      markIndentedBullets(lines);
    }
  }
  return doc;
}
