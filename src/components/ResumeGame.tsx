import * as React from 'react';
import JSZip from 'jszip';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { cn } from '../lib/utils';

const ACTION_VERBS = [
  'achieved',
  'accelerated',
  'advanced',
  'advised',
  'advocated',
  'analyzed',
  'architected',
  'authored',
  'automated',
  'built',
  'boosted',
  'brokered',
  'captained',
  'chaired',
  'championed',
  'charted',
  'coached',
  'collaborated',
  'communicated',
  'completed',
  'conceived',
  'conducted',
  'consolidated',
  'constructed',
  'consulted',
  'coordinated',
  'created',
  'cultivated',
  'decreased',
  'delivered',
  'demonstrated',
  'designed',
  'developed',
  'devised',
  'directed',
  'doubled',
  'drove',
  'earned',
  'edited',
  'eliminated',
  'established',
  'evaluated',
  'executed',
  'expanded',
  'expedited',
  'facilitated',
  'founded',
  'generated',
  'grew',
  'guided',
  'headed',
  'helped',
  'identified',
  'implemented',
  'improved',
  'inaugurated',
  'increased',
  'influenced',
  'initiated',
  'innovated',
  'inspected',
  'installed',
  'instituted',
  'instructed',
  'integrated',
  'launched',
  'led',
  'managed',
  'mastered',
  'mentored',
  'moderated',
  'monitored',
  'negotiated',
  'obtained',
  'operated',
  'organized',
  'originated',
  'oversaw',
  'performed',
  'pioneered',
  'planned',
  'presented',
  'produced',
  'programmed',
  'promoted',
  'proposed',
  'published',
  'reduced',
  'refined',
  'reorganized',
  'replaced',
  'resolved',
  'revamped',
  'reversed',
  'revitalized',
  'saved',
  'scheduled',
  'secured',
  'spearheaded',
  'standardized',
  'streamlined',
  'strengthened',
  'structured',
  'succeeded',
  'supervised',
  'supported',
  'taught',
  'tested',
  'trained',
  'transformed',
  'troubleshot',
  'upgraded',
  'won',
];

const SCAN_DURATION = 8000;
const POWER_WORDS = ACTION_VERBS;

type ResumeGameProps = {
  showHeader?: boolean;
  className?: string;
};

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="R1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

type BulletFields = { verb: string; task: string; impact: string; quantifier: string };
type BulletRecord = {
  id: string;
  original: string;
  fields: BulletFields;
  baselineScore: number;
  improved: string;
  improvedScore: number;
};
type SignalReport = { visible: number; hidden: number; numbers: number; verbs: number };

function usePersistedState<T>(key: string, initial: T) {
  const [value, setValue] = React.useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const stored = localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : initial;
    } catch {
      return initial;
    }
  });

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore storage failures
    }
  }, [key, value]);

  return [value, setValue] as const;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function highlightResume(text: string) {
  if (!text) return '';
  let highlighted = escapeHtml(text);
  highlighted = highlighted.replace(/\d+\.?\d*%?/g, '<mark class="bg-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary-foreground))] px-1 rounded">$&</mark>');
  POWER_WORDS.forEach((word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    highlighted = highlighted.replace(regex, `<mark class="bg-[hsl(var(--love)/0.3)] text-[hsl(var(--love-foreground))] px-1 rounded">$&</mark>`);
  });
  return highlighted;
}

function extractBullets(text: string) {
  const lines = text.match(/^[-•*]\s+.+$/gm);
  if (lines && lines.length > 0) return lines;
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `• ${line}`);
}

const uniqueId = (prefix: string, index: number) => `${prefix}-${index}-${Math.random().toString(36).slice(2, 7)}`;

function capitalizeWord(word: string) {
  if (!word) return '';
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function seedFields(text: string): BulletFields {
  const cleaned = text.replace(/^[-•*]\s*/, '').trim();
  const words = cleaned.split(/\s+/);
  const verb = words[0] || '';
  const remainder = words.slice(1).join(' ');
  let task = remainder;
  let impact = '';

  const byIndex = remainder.toLowerCase().indexOf(' by ');
  const toIndex = remainder.toLowerCase().indexOf(' to ');
  const splitIndex = byIndex >= 0 ? byIndex : toIndex;
  if (splitIndex >= 0) {
    task = remainder.slice(0, splitIndex).trim();
    impact = remainder.slice(splitIndex).trim();
  }

  const quantifier = cleaned.match(/\d+\.?\d*%?/g)?.[0] ?? '';

  return {
    verb: capitalizeWord(verb),
    task: task.trim(),
    impact,
    quantifier,
  };
}

function buildBullet(fields: BulletFields) {
  const parts = [] as string[];
  if (fields.verb) parts.push(capitalizeWord(fields.verb));
  if (fields.task) parts.push(fields.task.trim());
  let statement = parts.join(' ');
  if (fields.impact) {
    const normalized = fields.impact.trim();
    const needsConnector = !normalized.toLowerCase().startsWith('to') && !normalized.toLowerCase().startsWith('by');
    statement += needsConnector ? ` to ${normalized}` : ` ${normalized}`;
  }
  if (fields.quantifier) {
    statement += statement.includes(fields.quantifier) ? '' : ` (${fields.quantifier.trim()})`;
  }
  return `• ${statement.replace(/\s+/g, ' ').trim()}.`;
}

function scoreBullet(bullet: string) {
  const normalized = bullet.replace(/^[-•*]\s*/, '').trim().toLowerCase();
  if (!normalized) return 0;
  const hasVerb = ACTION_VERBS.some((verb) => normalized.startsWith(verb));
  const hasNumber = /\d/.test(normalized);
  const length = normalized.split(/\s+/).length;
  const clarity = length > 6 && length < 25;
  return (hasVerb ? 40 : 0) + (hasNumber ? 30 : 0) + (clarity ? 30 : 0);
}

function scoreLabel(score: number) {
  if (score >= 80) return { label: 'High signal', color: 'text-emerald-300' };
  if (score >= 50) return { label: 'Moderate', color: 'text-amber-300' };
  return { label: 'Hidden value', color: 'text-rose-300' };
}

function createBulletRecord(line: string, index: number): BulletRecord {
  const sanitized = line.replace(/\s+/g, ' ').trim();
  const fields = seedFields(sanitized);
  const improved = buildBullet(fields);
  return {
    id: uniqueId('bullet', index),
    original: sanitized.replace(/^[-•*]\s*/, ''),
    fields,
    baselineScore: scoreBullet(sanitized),
    improved,
    improvedScore: scoreBullet(improved),
  };
}

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function documentXml(content: string) {
  const paragraphs = content
    .split('\n')
    .map((line) => line.trimEnd())
    .map((line) =>
      line.length
        ? `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`
        : '<w:p/>'
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs}
    <w:sectPr/>
  </w:body>
</w:document>`;
}

async function exportDocx(filename: string, content: string) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
  zip.folder('_rels')?.file('.rels', RELS_XML);
  zip.folder('word')?.file('document.xml', documentXml(content));
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function ResumeGame({ showHeader = true, className }: ResumeGameProps) {
  const [resumeText, setResumeText] = usePersistedState('resume-game-text', '');
  const [bullets, setBullets] = React.useState<BulletRecord[]>([]);
  const [selectedBulletId, setSelectedBulletId] = React.useState<string | null>(null);
  const [isScanning, setIsScanning] = React.useState(false);
  const [scanProgress, setScanProgress] = React.useState(0);
  const [scanComplete, setScanComplete] = React.useState(false);
  const [needsRescan, setNeedsRescan] = React.useState(false);
  const [signalReport, setSignalReport] = React.useState<SignalReport>({ visible: 0, hidden: 100, numbers: 0, verbs: 0 });
  const frameRef = React.useRef<number | null>(null);

  const highlightedResume = React.useMemo(() => highlightResume(resumeText), [resumeText]);
  const selectedBullet = bullets.find((bullet) => bullet.id === selectedBulletId);
  const averageScore = bullets.length
    ? Math.round(bullets.reduce((sum, bullet) => sum + bullet.improvedScore, 0) / bullets.length)
    : 0;
  const quantifiedBullets = bullets.filter((bullet) => /\d/.test(bullet.improved)).length;
  const verbCoverage = bullets.length
    ? Math.round(
        (bullets.filter((bullet) =>
          ACTION_VERBS.some((verb) => bullet.improved.toLowerCase().replace(/^[-•*]\s*/, '').startsWith(verb))
        ).length /
          bullets.length) *
          100
      )
    : 0;

  React.useEffect(() => () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
  }, []);

  const analyzeResume = React.useCallback(() => {
    const lines = extractBullets(resumeText);
    const records = lines.map((line, index) => createBulletRecord(line, index));
    setBullets(records);
    setSelectedBulletId(records[0]?.id ?? null);

    const lower = resumeText.toLowerCase();
    const verbs = POWER_WORDS.filter((word) => lower.includes(word));
    const numbers = resumeText.match(/\d+\.?\d*%?/g) ?? [];
    const visible = Math.min(100, Math.round(((verbs.length + numbers.length) / Math.max(1, records.length * 2)) * 100));
    setSignalReport({ visible, hidden: 100 - visible, numbers: numbers.length, verbs: verbs.length });
    setNeedsRescan(false);
  }, [resumeText]);

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
    setResumeText(text);
    setNeedsRescan(true);
  };

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setResumeText(event.target.value);
    setNeedsRescan(true);
  };

  const updateBulletField = (id: string, field: keyof BulletFields, value: string) => {
    setBullets((previous) =>
      previous.map((bullet) => {
        if (bullet.id !== id) return bullet;
        const nextFields = { ...bullet.fields, [field]: value };
        const improved = buildBullet(nextFields);
        return { ...bullet, fields: nextFields, improved, improvedScore: scoreBullet(improved) };
      })
    );
  };

  const downloadTextFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
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

  const exportMarkdown = () => downloadTextFile('resume-game-report.md', markdownReport());
  const exportDoc = () => exportDocx('resume-game-report.docx', markdownReport());

  const resumeOutOfDate = needsRescan && scanComplete && resumeText.trim().length > 0;

  return (
    <div
      className={cn(
        'mx-auto max-w-6xl space-y-12 px-4 pb-20 text-[hsl(var(--foreground))]',
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
                setResumeText('');
                setBullets([]);
                setSelectedBulletId(null);
                setScanComplete(false);
              }}
            >
              Clear workspace
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
        </CardContent>
      </Card>

      {scanComplete && (
        <div className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
          <Card className="backdrop-blur-lg">
            <CardHeader>
              <CardTitle className="text-xl">Scan visualization</CardTitle>
              {resumeOutOfDate && (
                <p className="text-xs text-[hsl(var(--gold))]">Resume updated — rerun scan to refresh metrics.</p>
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
              <div className="grid grid-cols-2 gap-4 text-center text-sm">
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
            <Button type="button" onClick={exportMarkdown} className="h-12 flex-1">
              Export Markdown
            </Button>
            <Button
              type="button"
              onClick={exportDoc}
              className="h-12 flex-1 bg-[hsl(var(--foam)/0.18)] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--foam)/0.28)]"
            >
              Export DOCX
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
