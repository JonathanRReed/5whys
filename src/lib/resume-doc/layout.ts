import type { ResumeDoc, ResumeLine } from './types';

function topDown(a: ResumeLine, b: ResumeLine): number {
  return (a.box?.y ?? 0) - (b.box?.y ?? 0) || (a.box?.x ?? 0) - (b.box?.x ?? 0);
}

/** A persistent gutter needs at least two non-overlapping lines on each side. */
export function pageColumns(doc: ResumeDoc, pageIndex: number): ResumeLine[][] {
  const lines = doc.lines.filter((line) => line.pageIndex === pageIndex && line.box);
  const width = doc.pages[pageIndex]?.width;
  if (!width || lines.length < 4) return [lines.sort(topDown)];
  const candidates = [...new Set(lines.map((line) => line.box?.x ?? 0))].sort((a, b) => a - b);
  for (const rightStart of candidates) {
    if (rightStart < width * 0.2 || rightStart > width * 0.85) continue;
    const left = lines.filter((line) => line.box && line.box.x + line.box.width < rightStart - 18);
    const right = lines.filter((line) => line.box && line.box.x >= rightStart);
    if (left.length < 2 || right.length < 2) continue;
    const leftMin = Math.min(...left.map((line) => line.box?.y ?? 0));
    const leftMax = Math.max(...left.map((line) => line.box?.y ?? 0));
    const rightMin = Math.min(...right.map((line) => line.box?.y ?? 0));
    const rightMax = Math.max(...right.map((line) => line.box?.y ?? 0));
    if (Math.min(leftMax, rightMax) <= Math.max(leftMin, rightMin)) continue;
    // Do not mistake a single-column date rail for a separate text column.
    if (right.every((line) => /^[\d\s.,/–—-]+$/.test(line.text))) continue;
    const assigned = new Set([...left, ...right]);
    const spanning = lines.filter((line) => !assigned.has(line));
    if (
      spanning.some((line) => {
        const y = line.box?.y ?? 0;
        return y > Math.max(leftMin, rightMin) && y < Math.min(leftMax, rightMax);
      })
    )
      continue;
    return [left.sort(topDown), right.sort(topDown), spanning.sort(topDown)];
  }
  return [lines.sort(topDown)];
}

export function geometricLineOrder(doc: ResumeDoc): string[] {
  return doc.pages.flatMap((page) => {
    const groups = pageColumns(doc, page.index);
    const unpositioned = doc.lines.filter((line) => line.pageIndex === page.index && !line.box);
    if (groups.length === 1) {
      const positioned = groups[0];
      if (!positioned.length)
        return doc.lines.filter((line) => line.pageIndex === page.index).map((line) => line.id);
      return [...positioned, ...unpositioned].map((line) => line.id);
    }
    const [left, right, spanning] = groups;
    const firstY = Math.min(left[0]?.box?.y ?? 0, right[0]?.box?.y ?? 0);
    return [
      ...spanning.filter((line) => (line.box?.y ?? 0) < firstY),
      ...left,
      ...right,
      ...spanning.filter((line) => (line.box?.y ?? 0) >= firstY),
      ...unpositioned,
    ].map((line) => line.id);
  });
}

/** Collapse visual continuations for text consumers while leaving page records intact. */
/**
 * Wrapped lines of one paragraph as one line. A line-end hyphen ("back-of-"
 * then "house") is rejoined without a space, keeping the hyphen, because a
 * resume's compounds are written that way. Every reader of the resume joins
 * lines here, so the editor, the exports and a saved rewrite all agree.
 */
export function joinParts(parts: string[]): string {
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

export function logicalLines(lines: ResumeLine[]): ResumeLine[] {
  const byId = new Map(lines.map((line) => [line.id, line]));
  const continuations = new Map<string, ResumeLine[]>();
  for (const line of lines) {
    if (!line.continuationOf || !byId.has(line.continuationOf)) continue;
    const group = continuations.get(line.continuationOf) ?? [];
    group.push(line);
    continuations.set(line.continuationOf, group);
  }
  return lines.flatMap((line) => {
    if (line.continuationOf && byId.has(line.continuationOf)) return [];
    const group = continuations.get(line.id);
    return [group ? { ...line, text: joinParts([line, ...group].map((part) => part.text)) } : line];
  });
}
