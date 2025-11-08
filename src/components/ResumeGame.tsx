import * as React from 'react';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import QuickStartTiles from './QuickStartTiles';
import { cn } from '../lib/utils';
import {
  extractBullets,
  createBulletRecord,
  buildBullet,
  fieldBonus,
  editBonus,
  scoreBullet,
  scoreLabel,
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

const SCAN_DURATION = 8000;

type ResumeGameProps = {
  showHeader?: boolean;
  className?: string;
};

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
        return {
          ...previous,
          bullets: nextBullets,
          selectedBulletId: nextSelected,
        };
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

    const tick = (now: number) => {
      const elapsed = now - start;
      const nextProgress = Math.min(100, Math.round((elapsed / SCAN_DURATION) * 100));
      setScanProgress(nextProgress);
      if (elapsed >= SCAN_DURATION) {
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setResumeTextValue(decodeEntities(text));
    setNeedsRescan(true);
  };

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setResumeTextValue(decodeEntities(event.target.value));
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

  const exportMarkdown = React.useCallback(async () => {
    downloadTextFile(`${exportBase}.md`, markdownReport());
  }, [exportBase, markdownReport]);

  const exportDoc = React.useCallback(async () => {
    await exportDocx(`${exportBase}.docx`, markdownReport());
  }, [exportBase, markdownReport]);

  const exportWithStatus = React.useCallback(
    async (action: () => Promise<void>, successMessage: string, failureMessage: string) => {
      try {
        await action();
        setStatus(successMessage);
      } catch (error) {
        console.error('Export failed', error);
        setStatus(failureMessage);
      }
    },
    []
  );

  const resumeOutOfDate = needsRescan && scanComplete && resumeText.trim().length > 0;

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-6xl space-y-12 px-4 pb-20 text-[hsl(var(--foreground))]',
        showHeader ? 'pt-12' : 'pt-8',
        className
      )}
    >
      {showHeader && (
        <header className="space-y-4 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--foam))]">Career Lab</p>
          <h1 className="text-4xl font-semibold tracking-tight">Resume Game</h1>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
            Simulate an eight-second recruiter scan, highlight signal words, and systematically rewrite every bullet into a quantified, high-signal statement.
          </p>
          <QuickStartTiles
            className="max-w-4xl"
            items={[
              {
                title: 'Drop your draft',
                body: 'Paste bullets or upload a .txt file-use the sample resume if you need a quick demo.'
              },
              {
                title: 'Run the scan',
                body: 'Watch the 8-second pass surface verbs and numbers. Edit fields to experiment with stronger phrasing.'
              },
              {
                title: 'Export the wins',
                body: 'Download the improved set as Markdown or DOCX once the scores feel interview-ready.'
              }
            ]}
          />
        </header>
      )}

      <Card className="backdrop-blur-xl">
        <CardHeader className="space-y-4">
          <CardTitle className="text-2xl">Upload or paste resume</CardTitle>
          <p className="text-sm text-muted-foreground">
            Markdown or plain text works best. Bullets starting with •, -, or * are auto-detected.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col items-start gap-2">
              <Label className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Upload</Label>
              <Input
                type="file"
                accept=".txt,.md,.markdown,.text"
                onChange={handleFileUpload}
                className="w-full md:w-auto"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              className="md:ml-auto"
              onClick={() => {
                setSessionState(() => ({ ...EMPTY_SESSION }));
                setScanComplete(false);
                setNeedsRescan(false);
                setStatus('Workspace cleared. Paste a fresh resume to begin.');
              }}
            >
              Clear workspace
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full md:w-auto"
              onClick={() => {
                setResumeTextValue(SAMPLE_RESUME_TEXT);
                setNeedsRescan(true);
                setStatus('Sample resume loaded. Run the scan to see suggestions.');
              }}
            >
              Try sample resume
            </Button>
          </div>
          <Textarea
            value={resumeText}
            onChange={handleTextChange}
            placeholder="• Led a cross-functional pod launching...\n• Built an internal dashboard that..."
            className="min-h-[220px]"
          />
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Button
              type="button"
              onClick={handleScan}
              className="h-12 rounded-xl px-6"
              disabled={!resumeText.trim() || isScanning}
            >
              Simulate recruiter scan
            </Button>
            <p className="text-sm text-muted-foreground md:ml-4">
              {isScanning ? 'Scanning in progress...' : scanComplete ? 'Scan complete' : 'Ready when you are'}
            </p>
          </div>
          {(isScanning || scanProgress > 0) && (
            <div className="space-y-2">
              <div className="h-2 w-full overflow-hidden rounded-full border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.25)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--foam))] via-[hsl(var(--iris))] to-[hsl(var(--love))] transition-all"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                {isScanning ? `Scanning • ${scanProgress}%` : 'Scan ready'}
              </p>
            </div>
          )}
          {status ? (
            <p className="text-sm text-[hsl(var(--foam))]" role="status">
              {status}
            </p>
          ) : null}
          {storageNotice && !status ? (
            <p className="text-sm text-[hsl(var(--gold))]">{storageNotice}</p>
          ) : null}
        </CardContent>
      </Card>

      {scanComplete && (
        <div className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
          <Card className="backdrop-blur-lg">
            <CardHeader>
              <CardTitle className="text-xl">Scan visualization</CardTitle>
              {resumeOutOfDate && (
                <p className="text-xs text-[hsl(var(--gold))]">Resume updated - rerun scan to refresh metrics.</p>
              )}
            </CardHeader>
            <CardContent>
              <div
                className="min-h-[200px] rounded-2xl border border-[hsl(var(--border)/0.4)] bg-[hsl(var(--card)/0.65)] p-6 text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: highlightedResume.replace(/\n/g, '<br/>') }}
              />
            </CardContent>
          </Card>

          <Card className="backdrop-blur-lg">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl">Signal report</CardTitle>
              <p className="text-xs text-muted-foreground">Visible vs hidden value under an 8-second glance.</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                  <span>Visible value</span>
                  <span>{signalReport.visible}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.25)]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--foam))] via-[hsl(var(--iris))] to-[hsl(var(--love))]"
                    style={{ width: `${signalReport.visible}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 text-center text-sm sm:grid-cols-2">
                <div className="rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.45)] p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Numbers surfaced</p>
                  <p className="text-3xl font-semibold text-[hsl(var(--foam))]">{signalReport.numbers}</p>
                </div>
                <div className="rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.45)] p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Power verbs</p>
                  <p className="text-3xl font-semibold text-[hsl(var(--iris))]">{signalReport.verbs}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.3)] p-4 text-sm text-muted-foreground">
                <p>
                  Visible value blends quantification ({signalReport.numbers}) and power verbs ({signalReport.verbs}). Aim for 70%+ to stand out in a quick review.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {scanComplete && bullets.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[320px,minmax(0,1fr)]">
          <Card className="backdrop-blur-lg">
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">Bullets</CardTitle>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Select to rewrite</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {bullets.map((bullet) => {
                const delta = bullet.improvedScore - bullet.baselineScore;
                const label = scoreLabel(bullet.improvedScore);
                return (
                  <button
                    key={bullet.id}
                    type="button"
                    className={cn(
                      'w-full rounded-2xl border px-4 py-3 text-left transition',
                      bullet.id === selectedBulletId
                        ? 'border-[hsl(var(--foam)/0.8)] bg-[hsl(var(--foam)/0.16)] shadow-[0_0_30px_hsl(var(--foam)/0.25)]'
                        : 'border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.35)] hover:border-[hsl(var(--border)/0.5)]'
                    )}
                    onClick={() => setSelectedBulletId(bullet.id)}
                  >
                    <p
                      className="text-sm text-[hsl(var(--foreground))] overflow-hidden"
                      style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}
                    >
                      {bullet.original}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span className={label.color}>{label.label}</span>
                      <span className={delta >= 0 ? 'text-[hsl(var(--love))]' : 'text-[hsl(var(--destructive))]'}>
                        {delta >= 0 ? '+' : ''}
                        {delta}
                      </span>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card className="backdrop-blur-lg">
            <CardHeader>
              <CardTitle className="text-xl">Structured rewrite</CardTitle>
              {selectedBullet && (
                <p className="text-xs text-muted-foreground">
                  Baseline {selectedBullet.baselineScore}/100 → {selectedBullet.improvedScore}/100
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {selectedBullet ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Action verb</Label>
                      <Input
                        value={selectedBullet.fields.verb}
                        onChange={(event) => updateBulletField(selectedBullet.id, 'verb', event.target.value)}
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Quantifier</Label>
                      <Input
                        value={selectedBullet.fields.quantifier}
                        onChange={(event) => updateBulletField(selectedBullet.id, 'quantifier', event.target.value)}
                        className="mt-2"
                        placeholder="e.g., 32%, 120 users"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Task / What you did</Label>
                      <Textarea
                        value={selectedBullet.fields.task}
                        onChange={(event) => updateBulletField(selectedBullet.id, 'task', event.target.value)}
                        className="mt-2 min-h-[100px]"
                      />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Impact / Result</Label>
                      <Textarea
                        value={selectedBullet.fields.impact}
                        onChange={(event) => updateBulletField(selectedBullet.id, 'impact', event.target.value)}
                        className="mt-2 min-h-[100px]"
                      />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.3)] p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Live preview</p>
                    <p className="mt-3 text-base">{selectedBullet.improved}</p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Select a bullet on the left to edit.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {scanComplete && bullets.length > 0 && (
        <Card className="backdrop-blur-lg">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Before / After view</CardTitle>
            <p className="text-xs text-muted-foreground">High-signal rewrite preview.</p>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Before</p>
              <div className="space-y-3 rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.35)] p-5 text-sm text-muted-foreground">
                {bullets.map((bullet) => (
                  <p key={`${bullet.id}-before`}>• {bullet.original}</p>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">After</p>
              <div className="space-y-3 rounded-2xl border border-[hsl(var(--foam)/0.5)] bg-[hsl(var(--foam)/0.1)] p-5 text-sm text-[hsl(var(--foreground))]">
                {bullets.map((bullet) => (
                  <p key={`${bullet.id}-after`}>{bullet.improved}</p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {scanComplete && bullets.length > 0 && (
        <Card className="backdrop-blur-lg">
          <CardHeader>
            <CardTitle className="text-xl">Scoreboard</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.35)] p-4 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Avg score</p>
              <p className="text-3xl font-semibold">{averageScore}</p>
            </div>
            <div className="rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.35)] p-4 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Quantified bullets</p>
              <p className="text-3xl font-semibold text-[hsl(var(--foam))]">
                {quantifiedBullets}/{bullets.length}
              </p>
            </div>
            <div className="rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.35)] p-4 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Verb coverage</p>
              <p className="text-3xl font-semibold text-[hsl(var(--iris))]">{verbCoverage}%</p>
            </div>
            <div className="rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.35)] p-4 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Visible value</p>
              <p className="text-3xl font-semibold text-[hsl(var(--love))]">{signalReport.visible}%</p>
            </div>
          </CardContent>
        </Card>
      )}

      {scanComplete && bullets.length > 0 && (
        <Card className="backdrop-blur-lg">
          <CardHeader className="space-y-2">
            <CardTitle className="text-xl">Export & share</CardTitle>
            <p className="text-xs text-muted-foreground">Download an artifact for portfolio, mentor review, or future editing.</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 md:flex-row">
            <Button
              type="button"
              onClick={() => exportWithStatus(exportMarkdown, 'Markdown download ready in your files.', 'Unable to export Markdown. Try again soon.')}
              className="h-12 flex-1"
            >
              Export Markdown
            </Button>
            <Button
              type="button"
              onClick={() => exportWithStatus(exportDoc, 'DOCX download ready in your files.', 'Unable to export DOCX. Try again soon.')}
              className="h-12 flex-1 bg-[hsl(var(--foam)/0.18)] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--foam)/0.28)]"
            >
              Export DOCX
            </Button>
          </CardContent>
        </Card>
      )}
      {!scanComplete && (
        <Card className="border-[hsl(var(--border)/0.45)] bg-[hsl(var(--overlay)/0.26)]">
          <CardContent className="flex flex-col gap-3 py-8 text-center text-sm text-muted-foreground">
            <p>Paste a few bullets and tap <strong className="text-[hsl(var(--foreground))]">Simulate recruiter scan</strong> to see suggestions here.</p>
            <p>If you’re just exploring, load the sample resume to preview the full workflow.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
