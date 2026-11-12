import { datesIn } from './dates';
import { pageColumns } from './layout';
import type { RepairId, ResumeDoc, ResumeFinding, ResumeLine } from './types';

function finding(
  detector: string,
  claim: string,
  explanation: string,
  lineIds: string[] = [],
  severity: 'fix' | 'check' = 'check',
  repairId?: RepairId,
  suffix = ''
): ResumeFinding {
  return {
    id: `${detector}${suffix ? `:${suffix}` : ''}`,
    detector,
    group: 'document-reading',
    severity,
    lineIds,
    claim,
    explanation,
    ...(repairId ? { repairId } : {}),
  };
}

export function detectFileSize(doc: ResumeDoc): ResumeFinding[] {
  if (doc.file.sizeBytes <= 2_500_000) return [];
  return [
    {
      ...finding(
        'file-size',
        `This file is ${(doc.file.sizeBytes / 1_000_000).toFixed(2)} MB.`,
        "Greenhouse documents a 2.5 MB parsing limit. This is one vendor's limit, not a rule for every employer."
      ),
      citation: {
        label: 'Greenhouse: unsuccessful resume parse',
        url: 'https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse',
      },
    },
  ];
}
export function detectPageCount(doc: ResumeDoc): ResumeFinding[] {
  const count = doc.file.pageCount;
  return count !== null && count > 2
    ? [
        finding(
          'page-count',
          `${count} pages.`,
          'We read the page count from the PDF. Check that every page belongs in this resume.'
        ),
      ]
    : [];
}
export function detectUnreadablePages(doc: ResumeDoc): ResumeFinding[] {
  return doc.pages
    .filter((page) => !doc.lines.some((line) => line.pageIndex === page.index && line.text.trim()))
    .map((page) =>
      finding(
        'no-text',
        `We could not read text on page ${page.index + 1}.`,
        page.hasImages
          ? 'This page contains an image but no extractable text. Add the text to the structured copy or use a document with selectable text.'
          : 'No extractable text was found. This may be a blank page or content our extractor cannot read.',
        [],
        'fix',
        undefined,
        String(page.index)
      )
    );
}
export function detectColumns(doc: ResumeDoc): ResumeFinding[] {
  return doc.pages
    .filter((page) => pageColumns(doc, page.index).length > 1)
    .map((page) =>
      finding(
        'columns',
        'This looks like columns. Check the order below.',
        'We found text on both sides of a persistent gap. Compare the extraction order with the geometric order.',
        doc.lines.filter((line) => line.pageIndex === page.index).map((line) => line.id),
        'check',
        'linearize',
        String(page.index)
      )
    );
}
export function detectReadingOrder(doc: ResumeDoc): ResumeFinding[] {
  return doc.extractionOrder.some((id, index) => id !== doc.geometricOrder[index])
    ? [
        finding(
          'reading-order',
          'The extraction order differs from the page order.',
          'The content stream and our geometric reading order put these lines in different positions. Review both previews before changing the order.',
          doc.extractionOrder.filter((id, index) => id !== doc.geometricOrder[index]),
          'check',
          'linearize'
        ),
      ]
    : [];
}
export function detectContactPlacement(doc: ResumeDoc): ResumeFinding[] {
  const ids = new Set([
    doc.contact.email?.lineId,
    doc.contact.phone?.lineId,
    ...doc.contact.links.map((field) => field.lineId),
  ]);
  const lines = doc.lines.filter(
    (line) =>
      ids.has(line.id) ||
      (doc.contact.email && line.text.includes(doc.contact.email.value)) ||
      (doc.contact.phone && line.text.includes(doc.contact.phone.value))
  );
  return lines.flatMap((line) => {
    const page = doc.pages[line.pageIndex];
    const peripheral = line.origin.kind === 'header' || line.origin.kind === 'footer';
    const edge =
      line.box &&
      page?.width &&
      page.height &&
      (line.box.y < page.height * 0.06 ||
        line.box.y + line.box.height > page.height * 0.94 ||
        line.box.x < page.width * 0.04 ||
        line.box.x + line.box.width > page.width * 0.96);
    return peripheral || edge
      ? [
          finding(
            'contact-placement',
            peripheral
              ? `We found contact details in a DOCX ${line.origin.kind}.`
              : 'Your contact details sit near the page edge.',
            'Move these contact details to the top of the body so they appear with the resume text.',
            [line.id],
            'check',
            'move-contact',
            line.id
          ),
        ]
      : [];
  });
}
export function detectHeadings(doc: ResumeDoc): ResumeFinding[] {
  return (['experience', 'education', 'skills'] as const)
    .filter((kind) => !doc.sections.some((section) => section.kind === kind))
    .map((kind) =>
      finding(
        'heading',
        `No heading we recognize for ${kind}.`,
        'Our heading list is limited. Rename the relevant heading if the section is already here; add your own content if it is missing.',
        [],
        'check',
        'rename-heading',
        kind
      )
    );
}
export function detectMissingContact(doc: ResumeDoc): ResumeFinding[] {
  return [
    ...(!doc.contact.email
      ? [
          finding(
            'contact-missing',
            'We did not find an email address.',
            'Check the extracted text and add an email address if you want one on this resume.',
            [],
            'check',
            undefined,
            'email'
          ),
        ]
      : []),
    ...(!doc.contact.phone
      ? [
          finding(
            'contact-missing',
            'We did not find a phone number.',
            'Our phone reader recognizes North American numbers. Check the text if you use another format.',
            [],
            'check',
            undefined,
            'phone'
          ),
        ]
      : []),
    ...(!doc.contact.links.length
      ? [
          finding(
            'contact-missing',
            'We did not find a web link.',
            'Links are optional. Our reader looks for a URL, a LinkedIn profile, or a GitHub profile.',
            [],
            'check',
            undefined,
            'links'
          ),
        ]
      : []),
  ];
}
function lineFindings(
  doc: ResumeDoc,
  detector: string,
  test: (line: ResumeLine) => boolean,
  claim: (line: ResumeLine) => string,
  explanation: string
): ResumeFinding[] {
  return doc.lines
    .filter(test)
    .map((line) =>
      finding(detector, claim(line), explanation, [line.id], 'fix', 'replace-line', line.id)
    );
}
export function detectSpacedLetters(doc: ResumeDoc): ResumeFinding[] {
  return lineFindings(
    doc,
    'spaced-letters',
    (line) => /(?:^|\s)(?:[A-Za-z]\s+){3,}[A-Za-z](?:\s|$)/.test(line.text),
    (line) => `We read spaced-out letters in "${line.text}".`,
    'Check whether these separate letters should be a word. We leave initials and short abbreviations alone.'
  );
}
export function detectGarbageCharacters(doc: ResumeDoc): ResumeFinding[] {
  return lineFindings(
    doc,
    'characters',
    (line) =>
      /[\uFFFD\uE000-\uF8FF]|\(cid:\d+\)/i.test(line.text) ||
      [...line.text].some((character) => {
        const code = character.charCodeAt(0);
        return code < 32 && ![9, 10, 13].includes(code);
      }),
    (line) => `We read unmapped characters in "${line.text}".`,
    'These replacement, private-use, or control characters may indicate a font mapping problem. Compare this line with the original.'
  );
}
export function detectMixedDates(doc: ResumeDoc): ResumeFinding[] {
  const dates = doc.lines.flatMap((line) =>
    datesIn(line.text)
      .filter((date) => !/^May /i.test(date.text))
      .map((date) => ({ ...date, lineId: line.id }))
  );
  if (
    new Set(
      dates.map((date) =>
        date.style === 'numeric'
          ? `${date.style}:${date.text.replace(/\d/g, '')}:${date.text.split(/[/.-]/)[0].length}`
          : `${date.style}:${date.text.includes('.') ? 'period' : 'plain'}`
      )
    ).size < 2
  )
    return [];
  return [
    finding(
      'dates',
      `We read mixed date formats: ${[...new Set(dates.map((date) => `"${date.text}"`))].join(', ')}.`,
      'Choose one month-and-year style for the structured copy. Year-only dates remain year-only.',
      [...new Set(dates.map((date) => date.lineId))],
      'check',
      'normalize-dates'
    ),
  ];
}
export function detectTables(doc: ResumeDoc): ResumeFinding[] {
  const ids = doc.lines.filter((line) => line.origin.kind === 'table').map((line) => line.id);
  return ids.length
    ? [
        finding(
          'tables',
          'We read text inside a DOCX table.',
          'Table cells were read in row order. Check whether that order matches the resume you intended.',
          ids,
          'check',
          'linearize'
        ),
      ]
    : [];
}
export function detectTextBoxes(doc: ResumeDoc): ResumeFinding[] {
  const ids = doc.lines.filter((line) => line.origin.kind === 'text-box').map((line) => line.id);
  return ids.length
    ? [
        finding(
          'text-boxes',
          'We read text inside a DOCX text box.',
          'Text boxes are separate from body paragraphs. Move this text into the body to keep one reading order.',
          ids,
          'check',
          'linearize'
        ),
      ]
    : [];
}

/** Independent pure detectors. Their order is also the display order. */
export const documentDetectors = [
  detectFileSize,
  detectPageCount,
  detectUnreadablePages,
  detectColumns,
  detectReadingOrder,
  detectContactPlacement,
  detectHeadings,
  detectMissingContact,
  detectSpacedLetters,
  detectGarbageCharacters,
  detectMixedDates,
  detectTables,
  detectTextBoxes,
];
export function detectFindings(doc: ResumeDoc): ResumeFinding[] {
  return documentDetectors.flatMap((detect) => detect(doc));
}
