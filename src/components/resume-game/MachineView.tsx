import * as React from 'react';
import { createPortal } from 'react-dom';
import type { PrintModel, ResumeDoc, ResumeFinding, ResumeLine } from '../../lib/resume-doc';
import {
  checkExport,
  fixList,
  linearize,
  moveContactToTop,
  normalizeDates,
  toDocx,
  toPrintModel,
} from '../../lib/resume-doc';
import { cn } from '../../lib/utils';
import { withViewTransition } from '../../lib/view-transition';
import { Button } from '../ui/button';

type Props = {
  doc: ResumeDoc;
  /** Called with the repaired structured copy. The uploaded file is never changed. */
  onChange: (doc: ResumeDoc) => void;
};

const REPAIRS: Partial<
  Record<
    NonNullable<ResumeFinding['repairId']>,
    { label: string; done: string; run: (doc: ResumeDoc) => ResumeDoc }
  >
> = {
  linearize: {
    label: 'Put it in one column',
    done: 'Reordered into one column.',
    run: linearize,
  },
  'move-contact': {
    label: 'Move contact details into the body',
    done: 'Contact details moved under your name.',
    run: moveContactToTop,
  },
  'normalize-dates': {
    label: 'Use one date format',
    done: 'Dates now share one format.',
    run: (doc) => normalizeDates(doc),
  },
};

const ORIGIN_LABEL: Record<ResumeLine['origin']['kind'], string | null> = {
  body: null,
  header: 'from the header',
  footer: 'from the footer',
  'text-box': 'from a text box',
  table: 'from a table',
};

function summarize(findings: ResumeFinding[]) {
  const fix = findings.filter((f) => f.severity === 'fix').length;
  const check = findings.length - fix;
  if (!findings.length) return 'Nothing to fix in how this file reads.';
  const parts: string[] = [];
  if (fix) parts.push(`${fix} to fix`);
  if (check) parts.push(`${check} to check`);
  return parts.join(', ');
}

function download(bytes: Uint8Array, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Findings touching more lines than this are not pinned line by line. */
const MAX_PINNED_LINES = 3;

const baseName = (name: string) => name.replace(/\.[^.]+$/, '') || 'resume';

/**
 * The machine view: the resume as our extractor read it, in reading order,
 * with each finding pinned to the lines it concerns. Findings describe what
 * this extractor saw. They are not a verdict about any employer's system, and
 * there is deliberately no score.
 */
export default function MachineView({ doc, onChange }: Props) {
  const [activeFinding, setActiveFinding] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const [printModel, setPrintModel] = React.useState<PrintModel | null>(null);

  const linesById = React.useMemo(() => new Map(doc.lines.map((l) => [l.id, l])), [doc.lines]);
  const ordered = React.useMemo(
    () =>
      doc.extractionOrder.map((id) => linesById.get(id)).filter((l): l is ResumeLine => Boolean(l)),
    [doc.extractionOrder, linesById]
  );
  const orderIndex = React.useMemo(
    () => new Map(doc.extractionOrder.map((id, i) => [id, i + 1])),
    [doc.extractionOrder]
  );
  const findingsByLine = React.useMemo(() => {
    const map = new Map<string, ResumeFinding[]>();
    for (const finding of doc.findings) {
      for (const id of finding.lineIds) map.set(id, [...(map.get(id) ?? []), finding]);
    }
    return map;
  }, [doc.findings]);
  const activeLines = React.useMemo(
    () => new Set(doc.findings.find((f) => f.id === activeFinding)?.lineIds ?? []),
    [doc.findings, activeFinding]
  );

  const pagesWithGeometry = doc.pages.filter((page) => page.width && page.height);

  const applyRepair = (finding: ResumeFinding) => {
    const repair = finding.repairId ? REPAIRS[finding.repairId] : undefined;
    if (!repair) return;
    try {
      // The reorder is the change the visitor asked for, so let them see it.
      const repaired = repair.run(doc);
      withViewTransition(() => onChange(repaired));
      setActiveFinding(null);
      setNotice(repair.done);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'That repair could not be applied to this file.'
      );
    }
  };

  const exportDocx = async () => {
    setExporting(true);
    try {
      const bytes = await toDocx(doc);
      download(
        bytes,
        `${baseName(doc.file.name)}-clean.docx`,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      const check = await checkExport(bytes);
      setNotice(
        check.ok
          ? check.contentFindings.length > 0
            ? 'Saved. We read the new file back: nothing to fix in how it reads. The optional checks above still apply.'
            : 'Saved. We read the new file back and found nothing to fix in how it reads.'
          : `Saved. Reading the new file back still shows ${summarize(check.exportFindings)}.`
      );
    } catch {
      setNotice('The file could not be written. Your resume here is unchanged.');
    } finally {
      setExporting(false);
    }
  };

  const printPdf = () => setPrintModel(toPrintModel(doc));

  // Print once the clean copy is in the document, then take it out again.
  React.useEffect(() => {
    if (!printModel) return undefined;
    const root = document.documentElement;
    root.dataset.print = 'resume';
    const done = () => {
      delete root.dataset.print;
      setPrintModel(null);
    };
    window.addEventListener('afterprint', done, { once: true });
    const frame = window.requestAnimationFrame(() => window.print());
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', done);
      delete root.dataset.print;
    };
  }, [printModel]);

  const copyFixList = async () => {
    try {
      await navigator.clipboard.writeText(fixList(doc).text);
      setNotice('Fix list copied.');
    } catch {
      setNotice('Copying was blocked by the browser.');
    }
  };

  return (
    <section aria-labelledby="machine-view-title" className="space-y-6">
      <div className="space-y-2">
        <h2 id="machine-view-title" className="text-2xl font-semibold">
          Machine view
        </h2>
        <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
          This is what our extractor read from {doc.file.name}, in the order it read it. Employer
          systems differ and none publishes a pass mark, so there is no score here: only what was
          read, and what may be worth fixing.
        </p>
        <p className="text-sm font-medium text-foreground" data-testid="machine-summary">
          {summarize(doc.findings)}
        </p>
      </div>

      <div
        className={cn(
          'grid gap-6',
          pagesWithGeometry.length > 0 && 'lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]'
        )}
      >
        {pagesWithGeometry.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">The page</h3>
            <div className="space-y-4 lg:sticky lg:top-24">
              {pagesWithGeometry.map((page) => (
                <PageSpecimen
                  key={page.index}
                  width={page.width as number}
                  height={page.height as number}
                  lines={doc.lines.filter((line) => line.pageIndex === page.index && line.box)}
                  orderIndex={orderIndex}
                  findingsByLine={findingsByLine}
                  activeLines={activeLines}
                  label={`Page ${page.index + 1}`}
                />
              ))}
              <p className="text-xs leading-relaxed text-muted-foreground">
                Each bar is a line of text where it sits on the page. The number is the order it was
                read in.
              </p>
            </div>
          </div>
        )}

        <div className="min-w-0 space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">What was read, in order</h3>
          {ordered.length === 0 ? (
            <p className="rounded-xl border border-border/40 p-4 text-sm text-muted-foreground">
              No text could be read from this file.
            </p>
          ) : (
            <ol
              className="max-h-[32rem] overflow-y-auto rounded-xl border border-border/40 bg-overlay/15 py-2 text-sm"
              style={{ viewTransitionName: 'machine-read-order' }}
            >
              {ordered.map((line, index) => {
                // A finding about the whole layout would repeat on every line; those
                // are shown through "Show the lines" instead.
                const pinned = findingsByLine
                  .get(line.id)
                  ?.filter((finding) => finding.lineIds.length <= MAX_PINNED_LINES);
                const active = activeLines.has(line.id);
                const origin = ORIGIN_LABEL[line.origin.kind];
                return (
                  <li
                    key={line.id}
                    className={cn(
                      'grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2 px-3 py-1 transition-colors',
                      active && 'bg-gold/15'
                    )}
                  >
                    <span className="pt-0.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          'break-words text-foreground',
                          line.continuationOf && 'pl-4 text-foreground/80'
                        )}
                      >
                        {line.bullet && !line.continuationOf && (
                          <span aria-hidden="true" className="mr-1.5 text-muted-foreground">
                            •
                          </span>
                        )}
                        {line.text}
                      </span>
                      {origin && (
                        <span className="ml-2 text-xs text-muted-foreground">({origin})</span>
                      )}
                      {pinned?.map((finding) => (
                        <button
                          key={finding.id}
                          type="button"
                          onClick={() => setActiveFinding(finding.id)}
                          className={cn(
                            'mt-1 block rounded-md px-2 py-0.5 text-left text-xs',
                            finding.severity === 'fix'
                              ? 'bg-love/15 text-love'
                              : 'bg-gold/15 text-gold'
                          )}
                        >
                          {finding.claim}
                        </button>
                      ))}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>

      {doc.findings.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Findings</h3>
          <ul className="grid gap-3 md:grid-cols-2">
            {doc.findings.map((finding) => {
              const repair = finding.repairId ? REPAIRS[finding.repairId] : undefined;
              const active = activeFinding === finding.id;
              return (
                <li
                  key={finding.id}
                  className={cn(
                    'space-y-2 rounded-xl border p-4 transition-colors',
                    active ? 'border-gold/70 bg-gold/8' : 'border-border/40'
                  )}
                >
                  <p
                    className={cn(
                      'text-xs font-medium',
                      finding.severity === 'fix' ? 'text-love' : 'text-gold'
                    )}
                  >
                    {finding.severity === 'fix' ? 'Fix' : 'Check'}
                  </p>
                  <p className="font-medium text-foreground">{finding.claim}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {finding.explanation}
                  </p>
                  {finding.citation && (
                    <p className="text-xs text-muted-foreground">
                      Source:{' '}
                      <a
                        className="underline underline-offset-2 hover:text-foreground"
                        href={finding.citation.url}
                        rel="noreferrer noopener"
                        target="_blank"
                      >
                        {finding.citation.label}
                      </a>
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {repair && (
                      <Button type="button" size="sm" onClick={() => applyRepair(finding)}>
                        {repair.label}
                      </Button>
                    )}
                    {finding.lineIds.length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-pressed={active}
                        onClick={() => setActiveFinding(active ? null : finding.id)}
                      >
                        {active ? 'Hide the lines' : 'Show the lines'}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="space-y-3 border-t border-border/40 pt-5">
        <h3 className="text-sm font-medium text-muted-foreground">Take it with you</h3>
        <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
          The clean copy is one column with standard headings and real bullets, built from the text
          above. Your uploaded file is never changed.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={exportDocx} disabled={exporting || !ordered.length}>
            {exporting ? 'Writing the file' : 'Download clean .docx'}
          </Button>
          <Button type="button" variant="outline" onClick={printPdf} disabled={!ordered.length}>
            Print or save as PDF
          </Button>
          {doc.findings.length > 0 && (
            <Button type="button" variant="outline" onClick={copyFixList}>
              Copy the fix list
            </Button>
          )}
        </div>
        <p role="status" className="min-h-5 text-sm text-foreground">
          {notice}
        </p>
      </div>

      {printModel &&
        createPortal(<PrintResume model={printModel} />, document.body, 'resume-print')}
    </section>
  );
}

type SpecimenProps = {
  width: number;
  height: number;
  lines: ResumeLine[];
  orderIndex: Map<string, number>;
  findingsByLine: Map<string, ResumeFinding[]>;
  activeLines: Set<string>;
  label: string;
};

/** A page drawn from geometry alone: one bar per line, where the line sits. */
function PageSpecimen({
  width,
  height,
  lines,
  orderIndex,
  findingsByLine,
  activeLines,
  label,
}: SpecimenProps) {
  return (
    <figure className="m-0">
      <div
        role="img"
        aria-label={`${label}: ${lines.length} lines of text shown where they sit on the page`}
        className="relative w-full overflow-hidden rounded-lg border border-border/50 bg-card"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        {lines.map((line) => {
          const box = line.box;
          if (!box) return null;
          const flagged = findingsByLine.get(line.id);
          const severity = flagged?.some((f) => f.severity === 'fix')
            ? 'fix'
            : flagged
              ? 'check'
              : null;
          return (
            <span
              key={line.id}
              aria-hidden="true"
              className={cn(
                'absolute flex items-center rounded-[2px] transition-colors',
                severity === 'fix'
                  ? 'bg-love/55'
                  : severity === 'check'
                    ? 'bg-gold/55'
                    : 'bg-foreground/22',
                activeLines.has(line.id) && 'bg-gold ring-2 ring-gold/60'
              )}
              style={{
                left: `${(box.x / width) * 100}%`,
                top: `${(box.y / height) * 100}%`,
                width: `${Math.max((box.width / width) * 100, 1)}%`,
                height: `${Math.max((box.height / height) * 100, 0.6)}%`,
              }}
            >
              <span className="-translate-x-full pr-1 font-mono text-[0.5rem] leading-none tabular-nums text-muted-foreground">
                {orderIndex.get(line.id)}
              </span>
            </span>
          );
        })}
      </div>
      <figcaption className="mt-1 text-xs text-muted-foreground">{label}</figcaption>
    </figure>
  );
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
