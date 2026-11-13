import { formatDates } from './dates';
import { headingKind, recomputeDoc } from './model';
import type { DateStyle, ResumeDoc, ResumeLine, SectionKind } from './types';

function checkedRepair(before: ResumeDoc, after: ResumeDoc): ResumeDoc {
  const previousIds = new Set(before.findings.map((finding) => finding.id));
  if (after.findings.some((finding) => !previousIds.has(finding.id))) {
    throw new Error('This change adds a document-reading finding. Review the replacement text.');
  }
  return after;
}

/** Geometry describes the uploaded file only. Edited copies become unpaginated body text. */
function reflow(doc: ResumeDoc, ids: string[]): ResumeDoc {
  const byId = new Map(doc.lines.map((line) => [line.id, line]));
  if (
    ids.length !== doc.lines.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !byId.has(id))
  )
    throw new Error('The new order must include every resume line exactly once.');
  return checkedRepair(
    doc,
    recomputeDoc({
      ...doc,
      pages: [{ index: 0, width: null, height: null, hasImages: null }],
      lines: ids.flatMap((id) => {
        const line = byId.get(id);
        return line
          ? [
              {
                ...line,
                pageIndex: 0,
                box: null,
                fontName: null,
                fontSize: null,
                origin: { kind: 'body' as const, part: 'structured-copy' },
                items: [],
              },
            ]
          : [];
      }),
    })
  );
}
/**
 * The order of a table laid out as columns, main column first. A two-column
 * Word template puts the sidebar (contact, skills, education) in the first
 * cell and the summary and experience in the second; read in cell order,
 * the clean copy would open with the sidebar. The cell that holds the
 * Experience heading goes first; everything else keeps its order.
 */
function mainColumnFirst(doc: ResumeDoc, order: string[]): string[] {
  const byId = new Map(doc.lines.map((line) => [line.id, line]));
  const rowOf = (id: string) => {
    const origin = byId.get(id)?.origin;
    return origin?.kind === 'table' ? `${origin.part}:${origin.table}:${origin.row}` : null;
  };
  const cellOf = (id: string) => {
    const origin = byId.get(id)?.origin;
    return origin?.kind === 'table' ? origin.cell : -1;
  };
  const leads = (ids: string[]) =>
    ids.some((id) => headingKind(byId.get(id)?.text ?? '') === 'experience');
  const out: string[] = [];
  for (let i = 0; i < order.length; ) {
    const row = rowOf(order[i]);
    let j = i + 1;
    while (row && j < order.length && rowOf(order[j]) === row) j += 1;
    const run = order.slice(i, j);
    const cells = new Map<number, string[]>();
    for (const id of run) cells.set(cellOf(id), [...(cells.get(cellOf(id)) ?? []), id]);
    const groups = [...cells.values()];
    const main = groups.filter(leads);
    out.push(
      ...(row && main.length === 1 && groups.length > 1
        ? [...main[0], ...groups.filter((group) => group !== main[0]).flat()]
        : run)
    );
    i = j;
  }
  return out;
}

export function linearize(doc: ResumeDoc): ResumeDoc {
  return reflow(doc, mainColumnFirst(doc, doc.geometricOrder));
}

const EMAIL = /[\w.!#$%&'*+/=?^`{|}~-]+@[\w.-]+\.[a-z]{2,}/i;
const PHONE = /(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\b\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/;
/** A line that is only a place: "Columbus, OH 43215", "Austin, Texas". */
const PLACE_ONLY =
  /^[A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,3},\s*(?:[A-Z]{2}|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)(?:\s+\d{5}(?:-\d{4})?)?$/;
/** A heading that only labels contact details. */
const CONTACT_HEADING = /^contact(?:\s+(?:info(?:rmation)?|details|me))?:?$/i;
/** What separates the parts of a contact line: "Columbus, OH | (614) 555-0187". */
const CONTACT_SEPARATOR = /\s*(?:[|•·▪]|\s{2,}|;)\s*/;
/**
 * The lines that are contact details. A line with an email address or a
 * phone number is one. A line with a link is one only when it is a short row
 * of its own ("linkedin.com/in/maya"): a bullet or a sentence that mentions a
 * project's address is part of its section and stays there.
 */
export function contactLineIds(doc: ResumeDoc): Set<string> {
  const byId = new Map(doc.lines.map((line) => [line.id, line]));
  const ids = new Set<string>();
  for (const field of [doc.contact.email, doc.contact.phone]) {
    if (field) ids.add(field.lineId);
  }
  // A second line with the same details (a page header that repeats them) is
  // contact too, so it moves with the first instead of staying at the end.
  for (const line of doc.lines) {
    if (line.bullet || line.continuationOf) continue;
    const words = line.text.trim().split(/\s+/).length;
    if ((EMAIL.test(line.text) || PHONE.test(line.text)) && words <= 16) ids.add(line.id);
  }
  for (const link of doc.contact.links) {
    const line = byId.get(link.lineId);
    if (!line || ids.has(line.id)) continue;
    const words = line.text.trim().split(/\s+/).length;
    if (!line.bullet && !line.continuationOf && words <= 6) ids.add(line.id);
  }
  // A place on its own line beside contact details, or under a Contact
  // heading, or in a page header, is part of the address.
  const order = doc.geometricOrder.length === doc.lines.length ? doc.geometricOrder : [];
  order.forEach((id, index) => {
    const line = byId.get(id);
    if (!line || ids.has(id) || line.bullet || !PLACE_ONLY.test(line.text.trim())) return;
    const near = [order[index - 1], order[index + 1]].map((other) =>
      other ? byId.get(other) : undefined
    );
    if (
      line.origin.kind === 'header' ||
      line.origin.kind === 'footer' ||
      near.some((other) => other && (ids.has(other.id) || CONTACT_HEADING.test(other.text.trim())))
    )
      ids.add(id);
  });
  return ids;
}

/** Comparable form of one part of a contact line: digits for a phone number. */
function contactKey(part: string): string {
  if (PHONE.test(part) && !EMAIL.test(part))
    return part.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return part
    .toLowerCase()
    .replace(/^(?:https?:\/\/)?(?:www\.)?/, '')
    .replace(/[\s/.,;:]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The contact lines as one line when they repeat each other: every part once,
 * in the order first written, a shorter part dropped when a longer one holds
 * it ("Columbus, OH" inside "Columbus, OH 43215"), and the name left out when
 * it already heads the resume. Null when nothing repeats, so separate lines
 * stay as the visitor wrote them.
 */
function mergedContact(lines: ResumeLine[], name: string | undefined): string | null {
  const parts: { text: string; key: string }[] = [];
  let repeated = false;
  const nameKey = name ? contactKey(name) : '';
  for (const line of lines) {
    for (const raw of line.text.split(CONTACT_SEPARATOR)) {
      const text = raw.trim();
      if (!text) continue;
      const key = contactKey(text);
      if (!key) continue;
      if (key === nameKey) {
        repeated = true;
        continue;
      }
      const holder = parts.findIndex((part) => part.key.includes(key) || key.includes(part.key));
      if (holder === -1) {
        parts.push({ text, key });
        continue;
      }
      repeated = true;
      if (key.length > parts[holder].key.length) parts[holder] = { text, key };
    }
  }
  return repeated && parts.length > 0 ? parts.map((part) => part.text).join(' | ') : null;
}
/**
 * Contact details under the name, at the top of the body. Details repeated in
 * a page header and the body appear once, as one line, and a Contact heading
 * left with nothing under it is dropped. A Word file keeps its other lines
 * where they were read (a table is still a table to put in one column); a
 * PDF copy becomes plain body text in page order, as before.
 */
export function moveContactToTop(doc: ResumeDoc): ResumeDoc {
  const contactIds = contactLineIds(doc);
  const byId = new Map(doc.lines.map((line) => [line.id, line]));
  const order = doc.geometricOrder;
  // A Contact heading whose lines all move goes with them.
  const emptied = new Set<string>();
  order.forEach((id, index) => {
    if (!CONTACT_HEADING.test(byId.get(id)?.text.trim() ?? '')) return;
    const rest = order.slice(index + 1);
    const end = rest.findIndex((other) => !contactIds.has(other));
    const under = end === -1 ? rest : rest.slice(0, end);
    const next = end === -1 ? undefined : byId.get(rest[end]);
    const closes =
      !next ||
      Boolean(headingKind(next.text)) ||
      (/[A-Z]/.test(next.text) && next.text === next.text.toUpperCase() && !next.bullet);
    if (under.length > 0 && closes) emptied.add(id);
  });
  const first = order.find((id) => !contactIds.has(id) && !emptied.has(id));
  const firstLine = first ? byId.get(first) : undefined;
  const nameId = firstLine && !headingKind(firstLine.text) && !firstLine.bullet ? first : undefined;
  const contactOrder = order.filter((id) => contactIds.has(id));
  const contactLines = contactOrder.flatMap((id) => byId.get(id) ?? []);
  const merged = mergedContact(contactLines, firstLine && nameId ? firstLine.text : undefined);
  const keptContact = merged ? contactOrder.slice(0, 1) : contactOrder;
  const ids = [
    ...(nameId ? [nameId] : []),
    ...keptContact,
    ...order.filter((id) => !contactIds.has(id) && id !== nameId && !emptied.has(id)),
  ];
  if (doc.source === 'pdf' && !merged && emptied.size === 0) return reflow(doc, ids);
  const flatten = doc.source === 'pdf';
  return checkedRepair(
    doc,
    recomputeDoc({
      ...doc,
      pages: [{ index: 0, width: null, height: null, hasImages: null }],
      lines: ids.flatMap((id) => {
        const line = byId.get(id);
        if (!line) return [];
        const moved = contactIds.has(id);
        return [
          {
            ...line,
            ...(moved && merged ? { text: merged } : {}),
            pageIndex: 0,
            box: null,
            fontName: flatten ? null : line.fontName,
            fontSize: flatten ? null : line.fontSize,
            origin:
              moved || flatten ? { kind: 'body' as const, part: 'structured-copy' } : line.origin,
            items: [],
          },
        ];
      }),
    })
  );
}
export function replaceLineText(doc: ResumeDoc, lineId: string, text: string): ResumeDoc {
  if (!doc.lines.some((line) => line.id === lineId))
    throw new Error('The resume line was not found.');
  if (!text.trim() || /[\r\n]/.test(text)) throw new Error('Use one nonempty line of text.');
  if (
    doc.lines.reduce(
      (sum, line) => sum + (line.id === lineId ? text.length : line.text.length),
      0
    ) > 200_000
  )
    throw new Error('This resume contains too much text.');
  const after = checkedRepair(
    doc,
    recomputeDoc({
      ...doc,
      lines: doc.lines.map((line) =>
        line.id === lineId
          ? { ...line, text, items: [], bullet: line.bullet || /^\s*[-•*◦○●▪]\s+/.test(text) }
          : line
      ),
    })
  );
  if (
    after.findings.some(
      (finding) => finding.repairId === 'replace-line' && finding.lineIds.includes(lineId)
    )
  ) {
    throw new Error('The replacement line still contains characters or spacing to check.');
  }
  return after;
}
export function renameHeading(
  doc: ResumeDoc,
  lineId: string,
  kind: Exclude<SectionKind, 'other'>
): ResumeDoc {
  return replaceLineText(doc, lineId, kind[0].toUpperCase() + kind.slice(1));
}
export function normalizeDates(doc: ResumeDoc, style: DateStyle = 'short-month'): ResumeDoc {
  return checkedRepair(
    doc,
    recomputeDoc({
      ...doc,
      lines: doc.lines.map((line) => ({ ...line, text: formatDates(line.text, style), items: [] })),
    })
  );
}
export function reorderSections(doc: ResumeDoc, sectionIds: string[]): ResumeDoc {
  if (
    sectionIds.length !== doc.sections.length ||
    new Set(sectionIds).size !== sectionIds.length ||
    sectionIds.some((id) => !doc.sections.some((section) => section.id === id))
  )
    throw new Error('Include every section exactly once.');
  const sections = new Map(doc.sections.map((section) => [section.id, section]));
  const members = new Set(
    doc.sections.flatMap((section) => [section.headingLineId, ...section.lineIds])
  );
  const preamble = doc.geometricOrder.filter((id) => !members.has(id));
  return reflow(doc, [
    ...preamble,
    ...sectionIds.flatMap((id) => {
      const section = sections.get(id);
      return section ? [section.headingLineId, ...section.lineIds] : [];
    }),
  ]);
}
