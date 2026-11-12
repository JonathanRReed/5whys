import { formatDates } from './dates';
import { headingKind, recomputeDoc } from './model';
import type { DateStyle, ResumeDoc, SectionKind } from './types';

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
export function linearize(doc: ResumeDoc): ResumeDoc {
  return reflow(doc, doc.geometricOrder);
}
export function moveContactToTop(doc: ResumeDoc): ResumeDoc {
  const contactIds = new Set([
    doc.contact.email?.lineId,
    doc.contact.phone?.lineId,
    ...doc.contact.links.map((field) => field.lineId),
  ]);
  const order = doc.geometricOrder;
  const first = order.find((id) => !contactIds.has(id));
  const firstLine = doc.lines.find((line) => line.id === first);
  const nameId = firstLine && !headingKind(firstLine.text) && !firstLine.bullet ? first : undefined;
  return reflow(doc, [
    ...(nameId ? [nameId] : []),
    ...order.filter((id) => contactIds.has(id)),
    ...order.filter((id) => !contactIds.has(id) && id !== nameId),
  ]);
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
