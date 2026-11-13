import * as React from 'react';
import type { ResumeDoc, ResumeFinding, ResumeLine } from '../../lib/resume-doc';
import {
  checkExport,
  countRewrites,
  docMatchesText,
  fixList,
  fromText,
  linearize,
  moveContactToTop,
  normalizeDates,
  renameHeading,
  replaceLineText,
  toDocx,
  toPrintModel,
} from '../../lib/resume-doc';
import { cn } from '../../lib/utils';
import { withViewTransition } from '../../lib/view-transition';
import { Button } from '../ui/button';
import { DOCX_TYPE, downloadBytes, usePrintResume } from './ResumeFile';

type Props = {
  doc: ResumeDoc;
  /** Called with the repaired structured copy. The uploaded file is never changed. */
  onChange: (doc: ResumeDoc) => void;
  /** Lines rewritten in the game below. They replace their originals in the clean copy. */
  rewrites?: readonly { original: string; improved: string; occurrence?: number }[];
  /**
   * The resume text the visitor has accepted in the paste field. When it no
   * longer matches what was read from the file, the clean copy is held back:
   * it would otherwise carry a resume the visitor has replaced.
   */
  text?: string;
  /**
   * Set when the structured copy on screen could not be saved on this
   * device. Repairs still show here, but nothing claims they were kept.
   */
  saveError?: string | null;
  /** Try the save again with the copy on screen. */
  onRetrySave?: () => void;
};

/** Headings the fixer can name a line as, in the words the finding uses. */
const HEADING_KINDS = ['experience', 'education', 'skills'] as const;
type HeadingKind = (typeof HEADING_KINDS)[number];
const HEADING_LABEL: Record<HeadingKind, string> = {
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
};

/** The heading a rename-heading finding is about: its id ends in the kind. */
function headingKindOf(finding: ResumeFinding): HeadingKind | null {
  const kind = finding.id.split(':')[1];
  return (HEADING_KINDS as readonly string[]).includes(kind) ? (kind as HeadingKind) : null;
}

/**
 * Lines that could be a heading under another name ("Where I have worked"):
 * short, no digits, no contact details, not a bullet, not already a heading
 * the reader knows.
 */
function headingCandidates(doc: ResumeDoc): ResumeLine[] {
  const known = new Set(doc.sections.map((section) => section.headingLineId));
  return doc.extractionOrder
    .map((id) => doc.lines.find((line) => line.id === id))
    .filter((line): line is ResumeLine => {
      if (!line || known.has(line.id) || line.bullet || line.continuationOf) return false;
      const text = line.text.trim();
      const words = text.split(/\s+/).filter(Boolean).length;
      return words >= 1 && words <= 5 && !/\d|@|https?:|www\./i.test(text) && text.length <= 40;
    })
    .slice(0, 40);
}

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
    done: 'Contact details moved under your name, each one once.',
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

/** Findings touching more lines than this are not pinned line by line. */
const MAX_PINNED_LINES = 3;

const baseName = (name: string) => name.replace(/\.[^.]+$/, '') || 'resume';

/**
 * The machine view: the resume as our extractor read it, in reading order,
 * with each finding pinned to the lines it concerns. Findings describe what
 * this extractor saw. They are not a verdict about any employer's system, and
 * there is deliberately no score.
 */
export default function MachineView({
  doc,
  onChange,
  rewrites,
  text,
  saveError,
  onRetrySave,
}: Props) {
  const current = React.useMemo(() => text === undefined || docMatchesText(doc, text), [doc, text]);
  const rewriteCount = React.useMemo(() => countRewrites(doc, rewrites), [doc, rewrites]);
  const [activeFinding, setActiveFinding] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [exporting, setExporting] = React.useState(false);
  // The copy before the last repair, so one tap takes the repair back.
  const [undo, setUndo] = React.useState<{ doc: ResumeDoc; label: string } | null>(null);
  // The finding whose line is open for editing, and the wording typed so far.
  const [editing, setEditing] = React.useState<{ findingId: string; text: string } | null>(null);
  // The line picked as the heading for each missing-heading finding.
  const [picked, setPicked] = React.useState<Record<string, string>>({});
  const candidates = React.useMemo(() => headingCandidates(doc), [doc]);
  // A different resume (a new upload, or the copy rebuilt from the text)
  // has nothing to undo or retype.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when the source changes
  React.useEffect(() => {
    setUndo(null);
    setEditing(null);
    setPicked({});
  }, [doc.file.name, doc.sourceText]);
  const [print, printPortal] = usePrintResume();

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

  // Every repair goes through here: the copy before it is kept for undo,
  // and findings are read again from the repaired copy.
  const commit = (run: () => ResumeDoc, done: string) => {
    try {
      const repaired = run();
      // The reorder is the change the visitor asked for, so let them see it.
      withViewTransition(() => onChange(repaired));
      setUndo({ doc, label: done });
      setActiveFinding(null);
      setEditing(null);
      setNotice(done);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'That repair could not be applied to this file.'
      );
    }
  };

  const applyRepair = (finding: ResumeFinding) => {
    const repair = finding.repairId ? REPAIRS[finding.repairId] : undefined;
    if (!repair) return;
    commit(() => repair.run(doc), repair.done);
  };

  const replaceLine = (finding: ResumeFinding) => {
    const lineId = finding.lineIds[0];
    if (!editing || !lineId) return;
    commit(() => replaceLineText(doc, lineId, editing.text.trim()), 'Line replaced.');
  };

  const nameHeading = (finding: ResumeFinding, kind: HeadingKind) => {
    const lineId = picked[finding.id];
    const line = lineId ? linesById.get(lineId) : undefined;
    if (!line) return;
    commit(
      () => renameHeading(doc, line.id, kind),
      `"${line.text.trim()}" now reads ${HEADING_LABEL[kind]}.`
    );
  };

  const undoRepair = () => {
    if (!undo) return;
    withViewTransition(() => onChange(undo.doc));
    setNotice(`Undone: ${undo.label}`);
    setUndo(null);
  };

  // Read the edited text as the new structured copy. The uploaded file is
  // never changed; repairs made to the old copy no longer apply.
  const readEditedText = () => {
    if (text === undefined) return;
    try {
      onChange({ ...fromText(text, doc.file.name), sourceText: text });
      setActiveFinding(null);
      setNotice('The clean copy now comes from the text above.');
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'The text above could not be read as a resume.'
      );
    }
  };

  const exportDocx = async () => {
    if (!current) return;
    setExporting(true);
    try {
      const bytes = await toDocx(doc, { rewrites });
      downloadBytes(bytes, `${baseName(doc.file.name)}-clean.docx`, DOCX_TYPE);
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

  const printPdf = () => {
    if (current) print(toPrintModel(doc, { rewrites }));
  };

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
          {doc.source === 'text'
            ? 'This is your edited text as our extractor read it, in order.'
            : `This is what our extractor read from ${doc.file.name}, in the order it read it.`}{' '}
          Employer systems differ and none publishes a pass mark, so there is no score here: only
          what was read, and what may be worth fixing.
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
                  {finding.repairId === 'replace-line' && finding.lineIds[0] && (
                    <LineEditor
                      findingId={finding.id}
                      original={linesById.get(finding.lineIds[0])?.text ?? ''}
                      editing={editing?.findingId === finding.id ? editing.text : null}
                      onStart={(value) => setEditing({ findingId: finding.id, text: value })}
                      onType={(value) => setEditing({ findingId: finding.id, text: value })}
                      onCancel={() => setEditing(null)}
                      onSave={() => replaceLine(finding)}
                    />
                  )}
                  {finding.repairId === 'rename-heading' &&
                    headingKindOf(finding) &&
                    candidates.length > 0 && (
                      <HeadingPicker
                        findingId={finding.id}
                        kind={headingKindOf(finding) as HeadingKind}
                        candidates={candidates}
                        value={picked[finding.id] ?? ''}
                        onPick={(lineId) =>
                          setPicked((current) => ({ ...current, [finding.id]: lineId }))
                        }
                        onRename={() => nameHeading(finding, headingKindOf(finding) as HeadingKind)}
                      />
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
        {!current && (
          <div
            className="space-y-2 rounded-xl border border-gold/50 bg-gold/8 p-4"
            data-testid="clean-copy-stale"
          >
            <p className="text-sm leading-relaxed text-foreground">
              The text above has changed since{' '}
              {doc.source === 'text' ? 'this copy was made' : `${doc.file.name} was read`}. This
              view and the clean copy still show the earlier text, so the download is off until they
              agree.
            </p>
            <Button type="button" size="sm" variant="outline" onClick={readEditedText}>
              Build the clean copy from the text above
            </Button>
          </div>
        )}
        <p className="text-sm text-foreground" data-testid="clean-copy-rewrites">
          {rewriteCount > 0
            ? `${rewriteCount} ${rewriteCount === 1 ? 'line you rewrote below is' : 'lines you rewrote below are'} in the clean copy in ${rewriteCount === 1 ? 'its' : 'their'} new wording.`
            : 'Lines you rewrite below go into the clean copy in their new wording.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={exportDocx}
            disabled={exporting || !ordered.length || !current}
          >
            {exporting ? 'Writing the file' : 'Download clean .docx'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={printPdf}
            disabled={!ordered.length || !current}
          >
            Print or save as PDF
          </Button>
          {doc.findings.length > 0 && (
            <Button type="button" variant="outline" onClick={copyFixList}>
              Copy the fix list
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p role="status" className="min-h-5 text-sm text-foreground">
            {notice}
          </p>
          {undo && (
            <Button type="button" size="sm" variant="outline" onClick={undoRepair}>
              Undo the last repair
            </Button>
          )}
        </div>
        {saveError && (
          <div
            className="space-y-2 rounded-xl border border-gold/50 bg-gold/8 p-4"
            role="alert"
            data-testid="machine-save-error"
          >
            <p className="text-sm leading-relaxed text-foreground">
              This copy is not saved on this device. {saveError} It stays on this page until you
              close it, and the downloads above still work.
            </p>
            {onRetrySave && (
              <Button type="button" size="sm" variant="outline" onClick={onRetrySave}>
                Try saving again
              </Button>
            )}
          </div>
        )}
      </div>

      {printPortal}
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
              <span className="-translate-x-full pr-1 font-mono text-[0.65rem] leading-none tabular-nums text-muted-foreground">
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

type LineEditorProps = {
  findingId: string;
  original: string;
  /** The wording being typed, or null while the editor is closed. */
  editing: string | null;
  onStart: (value: string) => void;
  onType: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
};

/** Fix one damaged line in place: the line as read, ready to retype. */
function LineEditor({
  findingId,
  original,
  editing,
  onStart,
  onType,
  onCancel,
  onSave,
}: LineEditorProps) {
  const id = `${findingId}-line`;
  if (editing === null) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => onStart(original)}>
        Retype this line
      </Button>
    );
  }
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        The line as it should read
      </label>
      <input
        id={id}
        // biome-ignore lint/a11y/noAutofocus: opened by the visitor's own press
        autoFocus
        value={editing}
        onChange={(event) => onType(event.target.value)}
        className="min-h-11 w-full rounded-md border border-border/50 bg-overlay/30 px-3 text-sm text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-foam"
      />
      <p className="text-xs text-muted-foreground">Was read as: {original}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={!editing.trim()}>
          Use this wording
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

type HeadingPickerProps = {
  findingId: string;
  kind: HeadingKind;
  candidates: ResumeLine[];
  value: string;
  onPick: (lineId: string) => void;
  onRename: () => void;
};

/** "Which line is your Experience heading?" Rename the one the visitor names. */
function HeadingPicker({
  findingId,
  kind,
  candidates,
  value,
  onPick,
  onRename,
}: HeadingPickerProps) {
  const id = `${findingId}-pick`;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        Is one of these your {HEADING_LABEL[kind].toLowerCase()} heading?
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onPick(event.target.value)}
        className="min-h-11 w-full max-w-sm rounded-md border border-border/50 bg-overlay/30 px-2 text-sm text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-foam"
      >
        <option value="">Pick a line</option>
        {candidates.map((line) => (
          <option key={line.id} value={line.id}>
            {line.text.trim()}
          </option>
        ))}
      </select>
      <Button type="button" size="sm" variant="outline" disabled={!value} onClick={onRename}>
        Rename it {HEADING_LABEL[kind]}
      </Button>
    </div>
  );
}
