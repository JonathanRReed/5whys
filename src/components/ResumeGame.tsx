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

function highlightResume(text: string) {
  if (!text) return '';
  let highlighted = text;
  highlighted = highlighted.replace(/\d+\.?\d*%?/g, '<mark class="bg-cyan-500/30 text-cyan-100 px-1 rounded">$&</mark>');
  POWER_WORDS.forEach((word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    highlighted = highlighted.replace(regex, `<mark class="bg-fuchsia-500/30 text-fuchsia-100 px-1 rounded">$&</mark>`);
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

export default function ResumeGame() {
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
    <div className="min-h-screen bg-[#050810] text-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-12 space-y-10">
        <header className="text-center space-y-4">
          <p className="text-xs uppercase tracking-[0.4em] text-cyan-300">Career Lab</p>
          <h1 className="text-4xl font-semibold">Resume Game</h1>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Simulate an eight-second recruiter scan, highlight signal words, and systematically rewrite every bullet into a
            quantified, high-signal statement.
          </p>
        </header>

        <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
          <CardHeader className="space-y-4">
            <CardTitle className="text-2xl text-white">Upload or paste resume</CardTitle>
            <p className="text-sm text-slate-400">Markdown or plain text works best. Bullets starting with •, -, or * are auto-detected.</p>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <Label className="text-xs uppercase tracking-[0.3em] text-slate-400">Upload</Label>
              <Input
                type="file"
                accept=".txt,.md,.markdown,.text"
                onChange={handleFileUpload}
                className="md:max-w-sm bg-black/30 border-white/10 text-sm text-slate-200 file:text-slate-300 file:bg-transparent file:border-0"
              />
              <Button
                type="button"
                variant="ghost"
                className="border border-white/10 bg-white/0 text-slate-300 hover:bg-white/10 md:ml-auto"
                onClick={() => {
                  setResumeText('');
                  setBullets([]);
                  setSelectedBulletId(null);
                  setScanComplete(false);
                  setSignalReport({ visible: 0, hidden: 100, numbers: 0, verbs: 0 });
                }}
              >
                Clear workspace
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Textarea
              value={resumeText}
              onChange={handleTextChange}
              placeholder="• Led a cross-functional pod launching...\n• Built an internal dashboard that..."
              className="min-h-[220px] resize-y border border-white/10 bg-black/30 text-slate-100 placeholder:text-slate-500"
            />
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <Button
                type="button"
                onClick={handleScan}
                className="h-12 rounded-xl border border-cyan-400/60 bg-cyan-500/20 px-6 text-white hover:bg-cyan-500/40"
                disabled={!resumeText.trim() || isScanning}
              >
                Simulate recruiter scan
              </Button>
              <p className="text-sm text-slate-400 md:ml-4">
                {isScanning ? 'Scanning in progress...' : scanComplete ? 'Scan complete' : 'Ready when you are'}
              </p>
            </div>
            {(isScanning || scanProgress > 0) && (
              <div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 transition-all"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
                <p className="mt-2 text-xs uppercase tracking-[0.3em] text-slate-400">
                  {isScanning ? `Scanning • ${scanProgress}%` : 'Scan ready'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {scanComplete && (
          <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
            <Card className="bg-white/5 border-white/10 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-xl text-white">Scan visualization</CardTitle>
                {resumeOutOfDate && <p className="text-xs text-amber-300">Resume updated — rerun scan to refresh metrics.</p>}
              </CardHeader>
              <CardContent>
                <div
                  className="min-h-[200px] rounded-2xl border border-white/10 bg-black/25 p-6 text-sm leading-relaxed text-slate-100"
                  dangerouslySetInnerHTML={{ __html: highlightedResume.replace(/\n/g, '<br/>') }}
                />
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10 backdrop-blur">
              <CardHeader className="space-y-2">
                <CardTitle className="text-xl text-white">Signal report</CardTitle>
                <p className="text-xs text-slate-400">Visible vs hidden value under an 8-second glance.</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="mb-2 flex justify-between text-xs text-slate-400">
                    <span>Visible value</span>
                    <span>{signalReport.visible}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500"
                      style={{ width: `${signalReport.visible}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Numbers surfaced</p>
                    <p className="text-3xl font-semibold text-cyan-300">{signalReport.numbers}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Strong verbs</p>
                    <p className="text-3xl font-semibold text-fuchsia-300">{signalReport.verbs}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/5 bg-black/20 p-4 text-sm text-slate-300">
                  <p>
                    Visible value blends quantification ({signalReport.numbers}) and power verbs ({signalReport.verbs}). Aim for
                    70%+ to stand out in a quick review.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {scanComplete && bullets.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-[320px,minmax(0,1fr)]">
            <Card className="bg-white/5 border-white/10 backdrop-blur">
              <CardHeader className="space-y-1">
                <CardTitle className="text-xl text-white">Bullets</CardTitle>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Select to rewrite</p>
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
                          ? 'border-cyan-400/80 bg-cyan-500/10 shadow-[0_0_30px_rgba(6,182,212,0.3)]'
                          : 'border-white/10 bg-black/20 hover:border-white/40'
                      )}
                      onClick={() => setSelectedBulletId(bullet.id)}
                    >
                      <p
                        className="text-sm text-slate-200 overflow-hidden"
                        style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}
                      >
                        {bullet.original}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                        <span className={label.color}>{label.label}</span>
                        <span className={delta >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                          {delta >= 0 ? '+' : ''}
                          {delta}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10 backdrop-blur-lg">
              <CardHeader>
                <CardTitle className="text-xl text-white">Structured rewrite</CardTitle>
                {selectedBullet && (
                  <p className="text-xs text-slate-400">
                    Baseline {selectedBullet.baselineScore}/100 → {selectedBullet.improvedScore}/100
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-5">
                {selectedBullet ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label className="text-xs uppercase tracking-[0.3em] text-slate-400">Action verb</Label>
                        <Input
                          value={selectedBullet.fields.verb}
                          onChange={(event) => updateBulletField(selectedBullet.id, 'verb', event.target.value)}
                          className="mt-2 border-white/10 bg-black/30 text-white placeholder:text-slate-500"
                        />
                      </div>
                      <div>
                        <Label className="text-xs uppercase tracking-[0.3em] text-slate-400">Quantifier</Label>
                        <Input
                          value={selectedBullet.fields.quantifier}
                          onChange={(event) => updateBulletField(selectedBullet.id, 'quantifier', event.target.value)}
                          className="mt-2 border-white/10 bg-black/30 text-white placeholder:text-slate-500"
                          placeholder="e.g., 32%, 120 users"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label className="text-xs uppercase tracking-[0.3em] text-slate-400">Task / What you did</Label>
                        <Textarea
                          value={selectedBullet.fields.task}
                          onChange={(event) => updateBulletField(selectedBullet.id, 'task', event.target.value)}
                          className="mt-2 min-h-[100px] border-white/10 bg-black/30 text-slate-100 placeholder:text-slate-500"
                        />
                      </div>
                      <div>
                        <Label className="text-xs uppercase tracking-[0.3em] text-slate-400">Impact / Result</Label>
                        <Textarea
                          value={selectedBullet.fields.impact}
                          onChange={(event) => updateBulletField(selectedBullet.id, 'impact', event.target.value)}
                          className="mt-2 min-h-[100px] border-white/10 bg-black/30 text-slate-100 placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Live preview</p>
                      <p className="mt-3 text-base text-white">{selectedBullet.improved}</p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-400">Select a bullet on the left to edit.</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {scanComplete && bullets.length > 0 && (
          <Card className="bg-white/5 border-white/10 backdrop-blur-lg">
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl text-white">Before / After view</CardTitle>
              <p className="text-xs text-slate-400">High-signal rewrite preview.</p>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Before</p>
                <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-slate-300">
                  {bullets.map((bullet) => (
                    <p key={`${bullet.id}-before`}>• {bullet.original}</p>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">After</p>
                <div className="space-y-3 rounded-2xl border border-cyan-400/30 bg-cyan-500/5 p-5 text-sm text-white">
                  {bullets.map((bullet) => (
                    <p key={`${bullet.id}-after`}>{bullet.improved}</p>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {scanComplete && bullets.length > 0 && (
          <Card className="bg-white/5 border-white/10 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-xl text-white">Scoreboard</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Avg score</p>
                <p className="text-3xl font-semibold text-white">{averageScore}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Quantified bullets</p>
                <p className="text-3xl font-semibold text-cyan-300">
                  {quantifiedBullets}/{bullets.length}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Verb coverage</p>
                <p className="text-3xl font-semibold text-fuchsia-300">{verbCoverage}%</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Visible value</p>
                <p className="text-3xl font-semibold text-emerald-300">{signalReport.visible}%</p>
              </div>
            </CardContent>
          </Card>
        )}

        {scanComplete && bullets.length > 0 && (
          <Card className="bg-white/5 border-white/10 backdrop-blur">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl text-white">Export & share</CardTitle>
              <p className="text-xs text-slate-400">Download an artifact for portfolio, mentor review, or future editing.</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 md:flex-row">
              <Button
                type="button"
                onClick={exportMarkdown}
                className="h-12 flex-1 rounded-xl border border-white/10 bg-white/10 text-white hover:bg-white/20"
              >
                Export Markdown
              </Button>
              <Button
                type="button"
                onClick={exportDoc}
                className="h-12 flex-1 rounded-xl border border-cyan-400/60 bg-cyan-500/20 text-white hover:bg-cyan-500/40"
              >
                Export DOCX
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
