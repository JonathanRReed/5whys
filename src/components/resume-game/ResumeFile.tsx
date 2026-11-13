import * as React from 'react';
import { createPortal } from 'react-dom';
import { loadFeature, reportFeatureFailure } from '../../lib/lazy-feature';
import type { PrintModel, ResumeDoc } from '../../lib/resume-doc';
import { resumeFileBase } from '../../lib/resume-game/first-resume';
import { Button } from '../ui/button';

export const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Hand the visitor a file made on this device. */
export function downloadBytes(bytes: Uint8Array, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Print a clean copy: put it in the document, open the print dialog, and
 * take it out again afterwards. Returns the function that starts it and the
 * portal to render.
 */
export function usePrintResume() {
  const [model, setModel] = React.useState<PrintModel | null>(null);
  React.useEffect(() => {
    if (!model) return undefined;
    const root = document.documentElement;
    root.dataset.print = 'resume';
    const done = () => {
      delete root.dataset.print;
      setModel(null);
    };
    window.addEventListener('afterprint', done, { once: true });
    const frame = window.requestAnimationFrame(() => window.print());
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', done);
      delete root.dataset.print;
    };
  }, [model]);
  const portal = model
    ? createPortal(<PrintResume model={model} />, document.body, 'resume-print')
    : null;
  return [setModel, portal] as const;
}

/** The clean copy, rendered only for printing. Plain black on white by design. */
function PrintResume({ model }: { model: PrintModel }) {
  const groups: { bullets: boolean; items: PrintModel['paragraphs'] }[] = [];
  for (const paragraph of model.paragraphs) {
    const bullets = paragraph.kind === 'bullet';
    const last = groups[groups.length - 1];
    if (last && last.bullets === bullets) last.items.push(paragraph);
    else groups.push({ bullets, items: [paragraph] });
  }
  return (
    <div
      className="resume-print"
      style={{ fontFamily: `${model.fontFamily}, Helvetica, sans-serif` }}
    >
      {groups.map((group) =>
        group.bullets ? (
          <ul key={group.items[0].lineId}>
            {group.items.map((p) => (
              <li key={p.lineId}>{p.text}</li>
            ))}
          </ul>
        ) : (
          group.items.map((p) =>
            p.kind === 'name' ? (
              <h1 key={p.lineId}>{p.text}</h1>
            ) : p.kind === 'heading' ? (
              <h2 key={p.lineId}>{p.text}</h2>
            ) : (
              <p key={p.lineId} data-kind={p.kind}>
                {p.text}
              </p>
            )
          )
        )
      )}
    </div>
  );
}

/**
 * The structured copy of a typed or pasted resume. Lines the Resume Game
 * reads as achievements become bullets, the same way the Application Desk
 * reads it, so a resume pasted without bullet marks still prints with them.
 */
async function docFromText(text: string): Promise<ResumeDoc> {
  const [{ fromText }, { detectResumeStructure }, { withAchievementLines }] = await Promise.all([
    loadFeature(import('../../lib/resume-doc')),
    loadFeature(import('../../lib/resume-game/structure')),
    loadFeature(import('../application-desk/ResumeStation')),
  ]);
  return withAchievementLines(fromText(text), detectResumeStructure(text).bullets);
}

/** The first line, when it reads as a name, names the file. */
function fileBase(text: string): string {
  const first =
    text
      .split('\n')
      .find((line) => line.trim())
      ?.trim() ?? '';
  const looksLikeName = first.split(/\s+/).length <= 4 && !/[\d@]/.test(first);
  return resumeFileBase(looksLikeName ? first : '');
}

type Props = {
  /** The resume as plain text, as typed, built, or pasted. */
  text: string;
  /** Lines rewritten in the game. They replace their originals in the file. */
  rewrites?: readonly { original: string; improved: string }[];
  /** Shown above the buttons. */
  children?: React.ReactNode;
  headingLevel?: 'h2' | 'h3';
  heading?: string;
};

/**
 * A .docx and a print or PDF copy of a resume that exists only as text.
 * An uploaded file gets the same two buttons in the machine view.
 */
export default function ResumeFileActions({
  text,
  rewrites,
  children,
  headingLevel = 'h2',
  heading = 'Take it with you',
}: Props) {
  const [notice, setNotice] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [print, portal] = usePrintResume();
  const headingId = React.useId();
  const Heading = headingLevel;
  const empty = !text.trim();

  const saveDocx = async () => {
    setBusy(true);
    setNotice('');
    try {
      const doc = await docFromText(text);
      const { toDocx, checkExport } = await loadFeature(import('../../lib/resume-doc'));
      const bytes = await toDocx(doc, { rewrites });
      downloadBytes(bytes, `${fileBase(text)}.docx`, DOCX_TYPE);
      const check = await checkExport(bytes);
      setNotice(
        check.ok
          ? 'Saved. We read the new file back and found nothing to fix in how it reads.'
          : 'Saved. Reading the new file back shows something to check: upload it above to see what.'
      );
    } catch (error) {
      reportFeatureFailure(error);
      setNotice('The file could not be written. Your resume here is unchanged.');
    } finally {
      setBusy(false);
    }
  };

  const printCopy = async () => {
    try {
      const doc = await docFromText(text);
      const { toPrintModel } = await loadFeature(import('../../lib/resume-doc'));
      print(toPrintModel(doc, { rewrites }));
    } catch (error) {
      reportFeatureFailure(error);
      setNotice('The print copy could not be made. Your resume here is unchanged.');
    }
  };

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <Heading
        id={headingId}
        className={headingLevel === 'h2' ? 'text-2xl font-semibold' : 'text-lg font-semibold'}
      >
        {heading}
      </Heading>
      {children}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button type="button" className="min-h-11" onClick={saveDocx} disabled={busy || empty}>
          {busy ? 'Writing the file' : 'Download .docx'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={printCopy}
          disabled={empty}
        >
          Print or save as PDF
        </Button>
      </div>
      <p role="status" className="min-h-5 text-sm text-foreground">
        {notice}
      </p>
      {portal}
    </section>
  );
}
