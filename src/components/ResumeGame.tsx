import * as React from 'react';
import { loadFeature, reportFeatureFailure } from '../lib/lazy-feature';
import { localDate } from '../lib/local-date';
import { readProfile } from '../lib/profile';
import type { ResumeDoc } from '../lib/resume-doc';
import {
  bulletRewrites,
  docMatchesText,
  isResumeLimitError,
  listedLineTexts,
  rewriteText,
} from '../lib/resume-doc';
import type { BulletFields, BulletRecord, Register, StoredResumeSession } from '../lib/resume-game';
import {
  analyzeResumeText,
  applyFieldChange,
  buildDeepSignalReport,
  buildReviewReport,
  createBulletRecord,
  decodeEntities,
  downloadTextFile,
  EMPTY_SESSION,
  EMPTY_SIGNAL_REPORT,
  exportDocx,
  FIRST_JOB_SAMPLE_RESUME,
  MAX_RESUME_FILE_MB,
  PROFESSIONAL_PLACEHOLDER,
  PROFESSIONAL_SAMPLE_RESUME,
  REVIEW_FILE_BASE,
  registerForStage,
  STRONG_SCORE,
  STUDENT_PLACEHOLDER,
  STUDENT_SAMPLE_RESUME,
  useResumeSession,
} from '../lib/resume-game';
import { cn, scrollBehavior } from '../lib/utils';
import BeforeAfter from './resume-game/BeforeAfter';
import BulletEditor from './resume-game/BulletEditor';
import BulletList from './resume-game/BulletList';
import FirstResumeBuilder from './resume-game/FirstResumeBuilder';
import MachineView from './resume-game/MachineView';
import PostingMatch from './resume-game/PostingMatch';
import ResumeFileActions from './resume-game/ResumeFile';
import ResumeHeader from './resume-game/ResumeHeader';
import ResumeInput from './resume-game/ResumeInput';
import ReviewLines from './resume-game/ReviewLines';
import ScanResults from './resume-game/ScanResults';
import Scoreboard from './resume-game/Scoreboard';
import ShareScoreCard from './resume-game/ShareScoreCard';
import Announcer, { useAnnouncer } from './shared/Announcer';

// Analysis is synchronous and instant. This brief transition only exists so
// the button press has visible feedback; it is not a fake progress display.
const SCAN_TRANSITION_MS = 300;
const STATUS_RESET_MS = 3500;

const STUDENT_SAMPLES = [
  { id: 'first-job', label: 'First job' },
  { id: 'college', label: 'College student' },
] as const;

const scoredStatus = (count: number) =>
  count === 0
    ? 'No achievement lines found. Add bullets that start with what you did.'
    : `Scored ${count === 1 ? '1 bullet' : `${count} bullets`}. Pick one below to rewrite it.`;

type ResumeGameProps = {
  showHeader?: boolean;
  className?: string;
};

export default function ResumeGame({ showHeader = true, className }: ResumeGameProps) {
  const { session, setSession, storageNotice } = useResumeSession();
  const [isScanning, setIsScanning] = React.useState(false);
  const [announcement, announce] = useAnnouncer();
  const [scanComplete, setScanComplete] = React.useState(false);
  const needsRescan = session.needsRescan ?? false;
  const [status, setStatus] = React.useState<string | null>(null);
  // Student examples until the visitor's saved profile says otherwise.
  const [register, setRegister] = React.useState<Register>('student');
  // High school examples in the start-from-nothing form for a first job.
  const [firstJob, setFirstJob] = React.useState(false);
  const scanTimeoutRef = React.useRef<number | null>(null);
  const deepLinkHandled = React.useRef(false);

  React.useEffect(() => {
    const profile = readProfile();
    setRegister(registerForStage(profile?.stage));
    setFirstJob(profile?.firstJob === true);
  }, []);

  const setSessionState = React.useCallback(
    (mutator: (previous: StoredResumeSession) => StoredResumeSession) => {
      setSession((previous) => mutator(previous));
    },
    [setSession]
  );

  const updateSessionPartial = React.useCallback(
    (partial: Partial<StoredResumeSession>) => {
      setSessionState((previous) => ({ ...previous, ...partial }));
    },
    [setSessionState]
  );

  const setResumeTextValue = React.useCallback(
    (value: string) => {
      updateSessionPartial({ resumeText: value, needsRescan: true });
    },
    [updateSessionPartial]
  );

  const setSelectedBulletId = React.useCallback(
    (id: string | null) => {
      updateSessionPartial({ selectedBulletId: id });
    },
    [updateSessionPartial]
  );

  const resumeText = session.resumeText;
  const bullets = session.bullets;
  // What the visitor changed, for the clean copy of the uploaded resume. Each
  // rewrite is bound to the line it came from, so equal lines stay separate.
  const rewrites = React.useMemo(() => bulletRewrites(bullets), [bullets]);
  // The posting is compared with the resume as it will be exported: the
  // original text with each rewritten line in its new wording.
  const matchText = React.useMemo(() => rewriteText(resumeText, rewrites), [rewrites, resumeText]);
  const selectedBulletId = session.selectedBulletId;
  const selectedBullet = bullets.find((bullet) => bullet.id === selectedBulletId) ?? null;
  const signalReport = session.signalReport ?? EMPTY_SIGNAL_REPORT;

  // The share card is only offered when every scored line is strong.
  const allStrong =
    bullets.length > 0 && bullets.every((bullet) => bullet.improvedScore >= STRONG_SCORE);

  React.useEffect(() => {
    if (!storageNotice) return;
    setStatus(storageNotice);
  }, [storageNotice]);

  React.useEffect(() => {
    if (!status) return;
    const timeout = window.setTimeout(() => setStatus(null), STATUS_RESET_MS);
    return () => window.clearTimeout(timeout);
  }, [status]);

  // Restored sessions already carry analyzed bullets; show them instead of
  // hiding results behind a rescan.
  React.useEffect(() => {
    if (session.lastAnalyzedAt && session.bullets.length > 0) {
      setScanComplete(true);
    }
  }, [session.lastAnalyzedAt, session.bullets.length]);

  // The dashboard links straight to a bullet (?bullet=<id>): select it once the
  // session is restored and bring the editor into view.
  React.useEffect(() => {
    if (deepLinkHandled.current || bullets.length === 0) return;
    const wanted = new URLSearchParams(window.location.search).get('bullet');
    if (!wanted) return;
    deepLinkHandled.current = true;
    if (!bullets.some((bullet) => bullet.id === wanted)) return;
    setSelectedBulletId(wanted);
    window.requestAnimationFrame(() => {
      document
        .getElementById('bullet-editor')
        ?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    });
  }, [bullets, setSelectedBulletId]);

  React.useEffect(
    () => () => {
      if (scanTimeoutRef.current) window.clearTimeout(scanTimeoutRef.current);
    },
    []
  );

  // The structured copy of an uploaded file, for the machine view. Pasted
  // text has no layout to inspect, so it stays null until a file is loaded.
  const [resumeDoc, setResumeDoc] = React.useState<ResumeDoc | null>(null);

  const analyzeResume = React.useCallback(() => {
    // The file's own sections say which lines are a skills list, wherever
    // the text puts them, while the text is still the file's.
    const analysis = analyzeResumeText(resumeText, {
      listedLines:
        resumeDoc && docMatchesText(resumeDoc, resumeText) ? listedLineTexts(resumeDoc) : [],
    });
    setSessionState((previous) => ({ ...previous, ...analysis }));
    setStatus(scoredStatus(analysis.bullets.length));
  }, [resumeDoc, resumeText, setSessionState]);

  const handleScan = () => {
    if (!resumeText.trim() || isScanning) return;
    setIsScanning(true);
    scanTimeoutRef.current = window.setTimeout(() => {
      analyzeResume();
      setIsScanning(false);
      setScanComplete(true);
      scanTimeoutRef.current = null;
    }, SCAN_TRANSITION_MS);
  };

  const cancelScan = () => {
    if (scanTimeoutRef.current !== null) {
      window.clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    setIsScanning(false);
  };

  const [isLoadingFile, setIsLoadingFile] = React.useState(false);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const uploadSequence = React.useRef(0);

  // Restore the structured copy saved on this device. Reading never writes:
  // it is only saved again after an upload or a repair the visitor made.
  React.useEffect(() => {
    let cancelled = false;
    void loadFeature(import('../lib/local-db'))
      .then(async ({ getResumeDoc }) => {
        const saved = await getResumeDoc<ResumeDoc>();
        if (!cancelled && saved) setResumeDoc((current) => current ?? saved.doc);
      })
      .catch(reportFeatureFailure);
    return () => {
      cancelled = true;
    };
  }, []);

  const keepResumeDoc = React.useCallback((doc: ResumeDoc | null) => {
    setResumeDoc(doc);
    void loadFeature(import('../lib/local-db'))
      .then(async ({ saveResumeDoc, deleteResumeDoc }) => {
        if (doc) await saveResumeDoc(doc);
        else await deleteResumeDoc();
      })
      .catch(reportFeatureFailure);
  }, []);

  React.useEffect(
    () => () => {
      uploadSequence.current += 1;
    },
    []
  );

  const cancelUpload = () => {
    uploadSequence.current += 1;
    setIsLoadingFile(false);
    setFileError(null);
  };

  const handleFileUpload = async (file: File) => {
    cancelScan();
    const sequence = ++uploadSequence.current;
    setFileError(null);
    setStatus(null);
    if (file.size > MAX_RESUME_FILE_MB * 1024 * 1024) {
      setIsLoadingFile(false);
      setFileError(`File too large. Maximum size is ${MAX_RESUME_FILE_MB} MB.`);
      return;
    }
    setIsLoadingFile(true);
    try {
      // The structured copy knows which lines are bullets and which visual
      // lines wrap, so the editor gets whole bullets from it, read once. When
      // the layout cannot be read, the plain extractor is used instead: it
      // gives the clear messages for scanned, locked, or damaged files.
      let doc: ResumeDoc | null = null;
      let text = '';
      const name = file.name.toLowerCase();
      if (name.endsWith('.pdf') || name.endsWith('.docx')) {
        try {
          const engine = await loadFeature(import('../lib/resume-doc'));
          doc = name.endsWith('.pdf')
            ? await engine.extractPdf(file)
            : await engine.extractDocx(new Uint8Array(await file.arrayBuffer()), file.name);
          text = engine.toEditorText(doc);
          // Kept with the copy, so a later edit to the paste field is noticed.
          doc = { ...doc, sourceText: text };
        } catch (error) {
          // A file refused for its size stays refused: the plain reader must
          // not take it instead.
          if (isResumeLimitError(error)) throw error;
          doc = null;
        }
        if (sequence !== uploadSequence.current) return;
      }
      if (!text.trim()) {
        doc = null;
        const { extractTextFromFile } = await loadFeature(import('../lib/resume-game/extractors'));
        text = await extractTextFromFile(file);
      }
      if (sequence !== uploadSequence.current) return;
      keepResumeDoc(doc);
      setResumeTextValue(text);
      setStatus('File loaded. Review the text below before analyzing.');
    } catch (error) {
      if (sequence !== uploadSequence.current) return;
      setFileError(error instanceof Error ? error.message : 'Failed to read file.');
    } finally {
      if (sequence === uploadSequence.current) setIsLoadingFile(false);
    }
  };

  // "Start from nothing": the form opens from its button, from
  // ?start=blank (the Application Desk links there), or because it was open
  // when the visitor last typed in it.
  const [builderOpen, setBuilderOpen] = React.useState(false);
  const [builderFocus, setBuilderFocus] = React.useState(false);
  const [builderMessage, announceBuilder] = useAnnouncer();
  // The form's announcer stays in the page once the form has opened, so the
  // message after "Use this as my resume" is heard after the form is gone.
  const [builderSeen, setBuilderSeen] = React.useState(false);
  React.useEffect(() => {
    if (builderOpen) setBuilderSeen(true);
  }, [builderOpen]);
  React.useEffect(() => {
    if (new URLSearchParams(window.location.search).get('start') === 'blank') setBuilderOpen(true);
  }, []);
  React.useEffect(() => {
    if (session.draft?.open) setBuilderOpen(true);
  }, [session.draft?.open]);

  const closeBuilder = () => {
    setBuilderOpen(false);
    const url = new URL(window.location.href);
    if (url.searchParams.has('start')) {
      url.searchParams.delete('start');
      window.history.replaceState(window.history.state, '', url);
    }
    // Only a form the visitor typed in is saved, so only that one is updated.
    if (session.draft?.open) {
      setSessionState((previous) =>
        previous.draft ? { ...previous, draft: { ...previous.draft, open: false } } : previous
      );
    }
  };

  // The built resume goes in exactly as pasted text does, already analyzed.
  const useBuiltResume = (text: string) => {
    cancelScan();
    cancelUpload();
    keepResumeDoc(null);
    const analysis = analyzeResumeText(text);
    setSessionState((previous) => ({
      ...previous,
      resumeText: text,
      ...analysis,
      draft: previous.draft ? { ...previous.draft, open: false } : previous.draft,
    }));
    setScanComplete(true);
    closeBuilder();
    setStatus(`Your resume is in the box. ${scoredStatus(analysis.bullets.length)}`);
    announceBuilder(`Your resume is in the box. ${scoredStatus(analysis.bullets.length)}`);
    window.requestAnimationFrame(() => {
      document.getElementById('bullet-editor')?.scrollIntoView?.({
        behavior: scrollBehavior(),
        block: 'start',
      });
      document.querySelector<HTMLElement>('[data-bullet-list] button')?.focus({
        preventScroll: true,
      });
    });
  };

  const handleTextChange = (value: string) => {
    cancelScan();
    cancelUpload();
    setResumeTextValue(decodeEntities(value));
  };

  const updateBulletField = (id: string, field: keyof BulletFields, value: string) => {
    setSessionState((previous) => {
      const nextBullets = previous.bullets.map((bullet: BulletRecord) =>
        bullet.id === id ? applyFieldChange(bullet, field, value) : bullet
      );
      // Keep the stored report in sync with edits.
      return {
        ...previous,
        bullets: nextBullets,
        signalReport: buildDeepSignalReport(
          nextBullets,
          previous.resumeText,
          previous.signalReport?.structureNote,
          previous.signalReport?.skippedLines
        ),
      };
    });
  };

  const reviewName = React.useCallback(
    () =>
      `${REVIEW_FILE_BASE}-${(session.lastAnalyzedAt ?? new Date().toISOString()).slice(0, 10)}`,
    [session.lastAnalyzedAt]
  );

  const reviewText = React.useCallback(() => buildReviewReport(bullets, localDate()), [bullets]);

  const handleExportMarkdown = React.useCallback(() => {
    downloadTextFile(`${reviewName()}.md`, reviewText());
  }, [reviewName, reviewText]);

  const handleExportDocx = React.useCallback(async () => {
    await exportDocx(`${reviewName()}.docx`, reviewText());
  }, [reviewName, reviewText]);

  const resumeOutOfDate = needsRescan && scanComplete && resumeText.trim().length > 0;
  const sampleResume = register === 'student' ? STUDENT_SAMPLE_RESUME : PROFESSIONAL_SAMPLE_RESUME;
  const placeholder = register === 'student' ? STUDENT_PLACEHOLDER : PROFESSIONAL_PLACEHOLDER;

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-6xl space-y-12 px-4 pb-20 text-foreground',
        showHeader ? 'pt-12' : 'pt-4',
        className
      )}
    >
      <ResumeHeader showHeader={showHeader} />

      {builderSeen && <Announcer message={builderMessage} />}
      {builderOpen && (
        <FirstResumeBuilder
          draft={session.draft ?? null}
          onDraftChange={(draft) => setSessionState((previous) => ({ ...previous, draft }))}
          onUse={useBuiltResume}
          onClose={() => {
            closeBuilder();
            announceBuilder('Back to paste or upload. What you typed in the form is kept.');
          }}
          currentText={resumeText}
          announce={announceBuilder}
          focusOnOpen={builderFocus}
          schoolExample={firstJob ? 'highSchool' : 'college'}
        />
      )}

      <ResumeInput
        hidden={builderOpen}
        onStartBlank={() => {
          setBuilderFocus(true);
          setBuilderOpen(true);
        }}
        samples={register === 'student' ? STUDENT_SAMPLES : undefined}
        resumeText={resumeText}
        isScanning={isScanning}
        scanComplete={scanComplete}
        isLoadingFile={isLoadingFile}
        status={status}
        fileError={fileError}
        storageNotice={storageNotice}
        needsRescan={needsRescan}
        placeholder={placeholder}
        onTextChange={handleTextChange}
        onFileUpload={handleFileUpload}
        onScan={handleScan}
        onLoadSample={(id) => {
          cancelScan();
          cancelUpload();
          setResumeTextValue(id === 'first-job' ? FIRST_JOB_SAMPLE_RESUME : sampleResume);
          keepResumeDoc(null);
          setStatus('Sample resume loaded. Run the analysis to see suggestions.');
        }}
        onClear={() => {
          cancelScan();
          cancelUpload();
          // The start-from-nothing form has its own Start over.
          setSessionState((previous) => ({ ...EMPTY_SESSION, draft: previous.draft }));
          setScanComplete(false);
          keepResumeDoc(null);
          setStatus('Workspace cleared. Paste a fresh resume to begin.');
        }}
      />

      {resumeDoc && (
        <MachineView
          doc={resumeDoc}
          onChange={keepResumeDoc}
          rewrites={rewrites}
          text={resumeText}
        />
      )}

      <PostingMatch resumeText={matchText} />

      {!scanComplete && resumeText.trim() && (
        <div className="rounded-2xl border border-dashed border-border/35 bg-overlay/15 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Press &quot;Analyze resume&quot; above to score each line and see what it is missing.
          </p>
        </div>
      )}

      {scanComplete && (
        <ScanResults
          bullets={bullets}
          resumeText={resumeText}
          signalReport={signalReport}
          resumeOutOfDate={resumeOutOfDate}
        />
      )}

      {scanComplete && !needsRescan && (
        <ReviewLines
          key={session.lastAnalyzedAt}
          bullets={bullets}
          onApply={(lines) => {
            const records = lines.map((line, index) => createBulletRecord(line, index));
            setSessionState((previous) => ({
              ...previous,
              bullets: records,
              selectedBulletId: records[0]?.id ?? null,
              signalReport: buildDeepSignalReport(
                records,
                previous.resumeText,
                `Reviewed ${records.length} ${records.length === 1 ? 'achievement line' : 'achievement lines'} selected by you.`,
                0
              ),
              lastAnalyzedAt: new Date().toISOString(),
              needsRescan: false,
            }));
            setStatus('Reviewed lines applied. Your pasted resume is unchanged.');
          }}
        />
      )}

      {scanComplete && bullets.length > 0 && (
        <div
          id="bullet-editor"
          className="grid gap-6 scroll-mt-24 lg:grid-cols-[320px_minmax(0,1fr)]"
        >
          <BulletList
            bullets={bullets}
            selectedBulletId={selectedBulletId}
            onSelect={(id) => {
              setSelectedBulletId(id);
              const chosen = bullets.find((b) => b.id === id);
              if (chosen) {
                const line =
                  chosen.original.length > 60
                    ? `${chosen.original.slice(0, 57).trimEnd()}...`
                    : chosen.original.replace(/[.\s]+$/, '');
                announce(`Rewriting: ${line}. Scores ${chosen.improvedScore}/100.`);
              }
            }}
          />
          <Announcer message={announcement} />
          <BulletEditor
            bullet={selectedBullet}
            index={bullets.findIndex((b) => b.id === selectedBulletId)}
            register={register}
            onFieldChange={updateBulletField}
          />
        </div>
      )}

      {scanComplete && bullets.length > 0 && <BeforeAfter bullets={bullets} />}

      {scanComplete && bullets.length > 0 && (
        <Scoreboard
          bullets={bullets}
          onExportMarkdown={handleExportMarkdown}
          onExportDocx={handleExportDocx}
        />
      )}

      {!resumeDoc && !builderOpen && resumeText.trim() && (
        <ResumeFileActions text={resumeText} rewrites={rewrites}>
          <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
            A one-column copy of the resume in the box, with standard headings and real bullets.
            Lines you rewrite above go into it in their new wording. It is made on this device.
          </p>
        </ResumeFileActions>
      )}

      {scanComplete && !needsRescan && allStrong && <ShareScoreCard bullets={bullets} />}
    </div>
  );
}
