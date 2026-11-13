export type ResumeSource = 'pdf' | 'docx' | 'text';

/** Coordinates in PDF points, measured from the top left of the displayed page. */
export type BoundingBox = { x: number; y: number; width: number; height: number };
export type LineOrigin =
  | { kind: 'body'; part: string }
  | { kind: 'header' | 'footer' | 'text-box'; part: string }
  | { kind: 'table'; part: string; table: number; row: number; cell: number };
export type ResumeTextItem = {
  text: string;
  box: BoundingBox;
  fontName: string;
  fontSize: number;
};
export type ResumeLine = {
  id: string;
  text: string;
  pageIndex: number;
  box: BoundingBox | null;
  fontName: string | null;
  fontSize: number | null;
  origin: LineOrigin;
  bullet: boolean;
  /** First visual line of this paragraph. Geometry and ids stay on every visual line. */
  continuationOf?: string;
  items: ResumeTextItem[];
};
export type ResumePage = {
  index: number;
  width: number | null;
  height: number | null;
  /** Null when image operators were not inspected. */
  hasImages: boolean | null;
};
export type SectionKind =
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'summary'
  | 'activities'
  | 'awards'
  | 'certifications'
  | 'other';
export type ResumeSection = {
  id: string;
  kind: SectionKind;
  headingLineId: string;
  lineIds: string[];
};
export type ContactField = { value: string; lineId: string };
export type ResumeContact = {
  email: ContactField | null;
  phone: ContactField | null;
  links: ContactField[];
};
export type RepairId =
  | 'linearize'
  | 'move-contact'
  | 'rename-heading'
  | 'normalize-dates'
  | 'replace-line';
export type ResumeFinding = {
  id: string;
  detector: string;
  group: 'document-reading';
  severity: 'fix' | 'check';
  lineIds: string[];
  claim: string;
  explanation: string;
  citation?: { label: string; url: string };
  repairId?: RepairId;
};
export type ResumeDoc = {
  source: ResumeSource;
  /** Imported file facts remain intact when the structured copy is repaired. */
  file: { name: string; sizeBytes: number; pageCount: number | null };
  /** DOCX and text have one unpaginated container with unknown dimensions. */
  pages: ResumePage[];
  /** Lines retain content-stream order until the structured copy is repaired. */
  lines: ResumeLine[];
  extractionOrder: string[];
  geometricOrder: string[];
  sections: ResumeSection[];
  contact: ResumeContact;
  plainText: string;
  findings: ResumeFinding[];
  /**
   * The editor text this copy produced when the file was read. The paste
   * field is compared with it to tell whether the visitor has since replaced
   * or edited the resume. Repairs keep it unchanged.
   */
  sourceText?: string;
};
export type DateStyle = 'short-month' | 'long-month' | 'numeric';
export type ExportOptions = {
  /** Omit to include every bullet. Non-bullet lines always remain. */
  bulletLineIds?: ReadonlySet<string>;
  /**
   * Lines the visitor rewrote, as the original text and what replaces it. A
   * line is matched on its words, ignoring its bullet mark, case and spacing,
   * and only its given occurrence (counted from 0, in reading order; the
   * first when omitted) is replaced, so equal lines under two employers stay
   * independent.
   */
  rewrites?: readonly { original: string; improved: string; occurrence?: number }[];
  /**
   * Bullets that are not in the resume, each placed after one of its lines.
   * One whose line is missing from the copy goes after the last bullet.
   */
  addedBullets?: readonly { afterLineId: string; text: string }[];
  /** Omit to preserve dates exactly as written. */
  dateStyle?: DateStyle;
};
export type PrintParagraph = {
  lineId: string;
  /** `title` is a job or role line: "Shift Supervisor, Midwest Fulfillment  Mar 2017 - Apr 2018". */
  kind: 'name' | 'contact' | 'heading' | 'title' | 'bullet' | 'text';
  text: string;
};
export type PrintModel = {
  fontFamily: 'Arial';
  fontSizePt: number;
  page: { widthPt: number; heightPt: number; marginPt: number };
  paragraphs: PrintParagraph[];
};
export type ExportCheck = {
  doc: ResumeDoc;
  /** All read-back findings, including optional content checks. */
  findings: ResumeFinding[];
  /** Remaining document-reading problems. */
  exportFindings: ResumeFinding[];
  /** Missing content and date consistency, which require a visitor edit or an explicit repair. */
  contentFindings: ResumeFinding[];
  /** True when exportFindings is empty. Content checks remain available above. */
  ok: boolean;
};
