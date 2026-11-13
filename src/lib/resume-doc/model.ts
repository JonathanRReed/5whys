import { detectFindings } from './detectors';
import { geometricLineOrder, logicalLines } from './layout';
import { MAX_RESUME_TEXT, ResumeLimitError } from './limits';
import type { ResumeContact, ResumeDoc, ResumeLine, ResumeSection, SectionKind } from './types';

const HEADINGS: Array<[SectionKind, RegExp]> = [
  [
    'experience',
    /^(?:(?:work|professional|relevant|volunteer|research) experience|experience|employment|work history)$/i,
  ],
  ['education', /^(education|academic background|academic history)$/i],
  ['skills', /^(?:(?:technical|professional|core) skills|skills|core competencies|technologies)$/i],
  ['projects', /^(?:relevant |academic )?projects$/i],
  ['summary', /^(summary|profile|objective|about me)$/i],
  ['activities', /^(leadership|activities|volunteering|interests)$/i],
  ['awards', /^(awards|honors)$/i],
  ['certifications', /^certifications?$/i],
];

export function headingKind(text: string): SectionKind | null {
  return HEADINGS.find(([, pattern]) => pattern.test(text.trim().replace(/:$/, '')))?.[0] ?? null;
}

export function parseContact(lines: ResumeLine[]): ResumeContact {
  const contact: ResumeContact = { email: null, phone: null, links: [] };
  for (const line of lines) {
    const email = line.text.match(/[\w.!#$%&'*+/=?^`{|}~-]+@[\w.-]+\.[a-z]{2,}/i)?.[0];
    const phone = line.text.match(
      /(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\b\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/
    )?.[0];
    if (email && !contact.email) contact.email = { value: email, lineId: line.id };
    if (phone && !contact.phone) contact.phone = { value: phone, lineId: line.id };
    for (const match of line.text.matchAll(
      /(?:https?:\/\/|www\.|\b(?:linkedin\.com|github\.com)\/)[^\s<>|·]+/gi
    )) {
      const value = match[0].replace(/[.,;)]+$/, '');
      contact.links.push({ value, lineId: line.id });
    }
  }
  return contact;
}

export function recomputeDoc(doc: ResumeDoc): ResumeDoc {
  const next = structuredClone(doc);
  next.extractionOrder = next.lines.map((line) => line.id);
  next.geometricOrder = geometricLineOrder(next);
  next.plainText = logicalLines(next.lines)
    .map((line) => line.text)
    .join('\n');
  next.contact = parseContact(next.lines);
  const byId = new Map(next.lines.map((line) => [line.id, line]));
  const sections: ResumeSection[] = [];
  let current: ResumeSection | undefined;
  for (const id of next.geometricOrder) {
    const line = byId.get(id);
    if (!line) continue;
    const kind = headingKind(line.text);
    if (kind) {
      current = { id: `section:${id}`, kind, headingLineId: id, lineIds: [] };
      sections.push(current);
    } else if (current) current.lineIds.push(id);
  }
  next.sections = sections;
  next.findings = detectFindings(next);
  return next;
}

export function fromText(text: string, name = 'resume.txt'): ResumeDoc {
  if (text.length > MAX_RESUME_TEXT)
    throw new ResumeLimitError('This resume contains too much text.');
  const lines: ResumeLine[] = text
    .split(/\r?\n/)
    .map<ResumeLine>((value, index) => ({
      id: `text:${index}`,
      text: value.trimEnd(),
      pageIndex: 0,
      box: null,
      fontName: null,
      fontSize: null,
      origin: { kind: 'body', part: 'text' },
      bullet: /^\s*[-•*◦○●▪]\s+/.test(value),
      items: [],
    }))
    .filter((line) => line.text.trim());
  return recomputeDoc({
    source: 'text',
    file: { name, sizeBytes: new TextEncoder().encode(text).length, pageCount: null },
    pages: [{ index: 0, width: null, height: null, hasImages: null }],
    lines,
    extractionOrder: [],
    geometricOrder: [],
    sections: [],
    contact: { email: null, phone: null, links: [] },
    plainText: text,
    findings: [],
  });
}
