import * as React from 'react';
import { cn } from '../lib/utils';
import {
  extractBullets,
  createBulletRecord,
  buildBullet,
  fieldBonus,
  editBonus,
  scoreBullet,
  highlightResume,
  countPowerVerbs,
  decodeEntities,
  POWER_VERB_PATTERN,
  exportDocx,
  downloadTextFile,
  useResumeSession,
  EMPTY_SESSION,
  EMPTY_SIGNAL_REPORT,
} from '../lib/resume-game';
import type { BulletFields, BulletRecord, SignalReport, StoredResumeSession } from '../lib/resume-game';
import ResumeHeader from './resume-game/ResumeHeader';
import ResumeInput from './resume-game/ResumeInput';
import ScanResults from './resume-game/ScanResults';
import BulletList from './resume-game/BulletList';
import BulletEditor from './resume-game/BulletEditor';
import BeforeAfter from './resume-game/BeforeAfter';
import Scoreboard from './resume-game/Scoreboard';
import ShareScoreCard from './resume-game/ShareScoreCard';

const SCAN_DURATION = 8000;
const STATUS_RESET_MS = 3500;
const SAMPLE_RESUME_TEXT = `• Led a 6-person product pod launching a pricing diagnostics dashboard adopted by 4 global regions within the first quarter.
• Automated weekly revenue reporting with Python + Airflow, trimming manual analysis time by 9 hours per analyst.
• Mentored three new hires, coaching them on stakeholder narrative reviews that helped lift NPS by 14 points.`;

function slugify(value: string) {
  if (!value) return '';
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

type ResumeGameProps = {
  showHeader?: boolean;
  className?: string;
};

export default function ResumeGame({ showHeader = true, className }: ResumeGameProps) {
  const { session, setSession, storageNotice } = useResumeSession();
  const [isScanning, setIsScanning] = React.useState(false);
  const [scanProgress, setScanProgress] = React.useState(0);
  const [scanComplete, setScanComplete] = React.useState(false);
  const [needsRescan, setNeedsRescan] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const frameRef = React.useRef<number | null>(null);

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
      updateSessionPartial({ resumeText: value });
    },
    [updateSessionPartial]
  );

  const setBullets = React.useCallback(
    (updater: BulletRecord[] | ((previous: BulletRecord[]) => BulletRecord[])) => {
      setSessionState((previous) => {
        const nextBullets =
          typeof updater === 'function' ? (updater as (list: BulletRecord[]) => BulletRecord[])(previous.bullets) : updater;
        const nextSelected = nextBullets.length
          ? nextBullets.find((bullet) => bullet.id === previous.selectedBulletId)?.id ?? nextBullets[0].id
          : null;
        return { ...previous, bullets: nextBullets, selectedBulletId: nextSelected };
      });
    },
    [setSessionState]
  );

  const setSelectedBulletId = React.useCallback(
    (id: string | null) => {
      updateSessionPartial({ selectedBulletId: id });
    },
    [updateSessionPartial]
  );

  const setSignalReportValue = React.useCallback(
    (report: SignalReport) => {
      updateSessionPartial({ signalReport: report });
    },
    [updateSessionPartial]
  );

  const setLastAnalyzed = React.useCallback(() => {
    updateSessionPartial({ lastAnalyzedAt: new Date().toISOString() });
  }, [updateSessionPartial]);

  const resumeText = session.resumeText;
  const bullets = session.bullets;
  const selectedBulletId = session.selectedBulletId;
  const selectedBullet = bullets.find((bullet) => bullet.id === selectedBulletId) ?? null;
  const signalReport = session.signalReport ?? EMPTY_SIGNAL_REPORT;

  const highlightedResume = React.useMemo(() => highlightResume(resumeText), [resumeText]);
  const averageScore = bullets.length
    ? Math.round(bullets.reduce((sum, bullet) => sum + bullet.improvedScore, 0) / bullets.length)
    : 0;
  const quantifiedBullets = bullets.filter((bullet) => /\d/.test(bullet.improved)).length;
  const verbCoverage = bullets.length
    ? Math.round(
        (bullets.filter((bullet) => POWER_VERB_PATTERN.test(bullet.improved.toLowerCase())).length / bullets.length) * 100
      )
    : 0;

  React.useEffect(() => {
    if (!storageNotice) return;
    setStatus(storageNotice);
  }, [storageNotice]);

  React.useEffect(() => {
    if (!status) return;
    const timeout = window.setTimeout(() => setStatus(null), STATUS_RESET_MS);
    return () => window.clearTimeout(timeout);
  }, [status]);

  React.useEffect(() => () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
  }, []);

  const analyzeResume = React.useCallback(() => {
    const lines = extractBullets(resumeText);
    const records = lines.map((line, index) => createBulletRecord(line, index));
    setBullets(records);
    setSelectedBulletId(records[0]?.id ?? null);

    const verbCount = countPowerVerbs(resumeText);
    const numbers = resumeText.match(/\d+\.?\d*%?/g) ?? [];
    const visible = Math.min(100, Math.round(((verbCount + numbers.length) / Math.max(1, records.length * 2)) * 100));
    setSignalReportValue({ visible, hidden: 100 - visible, numbers: numbers.length, verbs: verbCount });
    setLastAnalyzed();
    setNeedsRescan(false);
    setStatus('Scan complete. Review the insights below.');
  }, [resumeText, setBullets, setLastAnalyzed, setSelectedBulletId, setSignalReportValue]);

  const handleScan = () => {
    if (!resumeText.trim() || isScanning) return;
    setScanProgress(0);
    setIsScanning(true);
    setScanComplete(false);
    const start = performance.now();

    let frameCount = 0;
    const tick = (now: number) => {
      frameCount++;
      if (frameCount % 3 !== 0) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }
      const elapsed = now - start;
      const nextProgress = Math.min(100, Math.round((elapsed / SCAN_DURATION) * 100));
      setScanProgress(nextProgress);
      if (elapsed >= SCAN_DURATION) {
        setScanProgress(100);
        setIsScanning(false);
        setScanComplete(true);
        analyzeResume();
        frameRef.current = null;
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
  };

  const handleFileUpload = async (file: File) => {
    const text = await file.text();
    setResumeTextValue(decodeEntities(text));
    setNeedsRescan(true);
  };

  const handleTextChange = (value: string) => {
    setResumeTextValue(decodeEntities(value));
    setNeedsRescan(true);
  };

  const updateBulletField = (id: string, field: keyof BulletFields, value: string) => {
    setBullets((previous) =>
      previous.map((bullet: BulletRecord) => {
        if (bullet.id !== id) return bullet;
        const nextFields = { ...bullet.fields, [field]: value };
        const improved = buildBullet(nextFields);
        const bonus = fieldBonus(nextFields) + editBonus(bullet.original, nextFields);
        return { ...bullet, fields: nextFields, improved, improvedScore: scoreBullet(improved) + bonus };
      })
    );
  };

  const markdownReport = () => {
    const original = bullets.map((bullet, index) => `${index + 1}. ${bullet.original}`);
    const improved = bullets.map((bullet, index) => `${index + 1}. ${bullet.improved}`);
    return `# Resume Game Report

## Scores
- Visible value: ${signalReport.visible}%
- Average improved bullet score: ${averageScore}/100
- Quantified bullets: ${quantifiedBullets}/${bullets.length || 0}

## Original Bullets
${original.join('\n')}

## Improved Bullets
${improved.join('\n')}
`;
  };

  const exportBase = React.useMemo(() => {
    const headline = bullets[0]?.improved || bullets[0]?.original || resumeText.split('\n').find((line) => line.trim()) || 'resume-session';
    const slug = slugify(headline).slice(0, 60) || 'resume-session';
    const stamped = (session.lastAnalyzedAt ?? new Date().toISOString()).slice(0, 10);
    return `resume-game-${slug}-${stamped}`;
  }, [bullets, resumeText, session.lastAnalyzedAt]);

  const handleExportMarkdown = React.useCallback(async () => {
    downloadTextFile(`${exportBase}.md`, markdownReport());
  }, [exportBase, markdownReport]);

  const handleExportDocx = React.useCallback(async () => {
    await exportDocx(`${exportBase}.docx`, markdownReport());
  }, [exportBase, markdownReport]);

  const resumeOutOfDate = needsRescan && scanComplete && resumeText.trim().length > 0;

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-6xl space-y-12 px-4 pb-20 text-[hsl(var(--foreground))]',
        showHeader ? 'pt-12' : 'pt-4',
        className
      )}
    >
      <ResumeHeader showHeader={showHeader} />

      <ResumeInput
        resumeText={resumeText}
        isScanning={isScanning}
        scanProgress={scanProgress}
        scanComplete={scanComplete}
        status={status}
        storageNotice={storageNotice}
        needsRescan={needsRescan}
        onTextChange={handleTextChange}
        onFileUpload={handleFileUpload}
        onScan={handleScan}
        onLoadSample={() => {
          setResumeTextValue(SAMPLE_RESUME_TEXT);
          setNeedsRescan(true);
          setStatus('Sample resume loaded. Run the scan to see suggestions.');
        }}
        onClear={() => {
          setSessionState(() => ({ ...EMPTY_SESSION }));
          setScanComplete(false);
          setNeedsRescan(false);
          setStatus('Workspace cleared. Paste a fresh resume to begin.');
        }}
      />

      {scanComplete && (
        <ScanResults
          highlightedResume={highlightedResume}
          signalReport={signalReport}
          resumeOutOfDate={resumeOutOfDate}
        />
      )}

      {scanComplete && bullets.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[320px,minmax(0,1fr)]">
          <BulletList bullets={bullets} selectedBulletId={selectedBulletId} onSelect={setSelectedBulletId} />
          <BulletEditor bullet={selectedBullet} onFieldChange={updateBulletField} />
        </div>
      )}

      {scanComplete && bullets.length > 0 && <BeforeAfter bullets={bullets} />}

      {scanComplete && bullets.length > 0 && (
        <Scoreboard
          averageScore={averageScore}
          quantifiedBullets={quantifiedBullets}
          totalBullets={bullets.length}
          verbCoverage={verbCoverage}
          onExportMarkdown={handleExportMarkdown}
          onExportDocx={handleExportDocx}
        />
      )}

      {scanComplete && bullets.length > 0 && (
        <ShareScoreCard
          bullets={bullets}
          averageScore={averageScore}
          signalReport={signalReport}
          verbCoverage={verbCoverage}
        />
      )}
    </div>
  );
}
