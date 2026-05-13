import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { signalGrade, suggestStrongerVerb } from '../../lib/resume-game';
import type { SignalReport } from '../../lib/resume-game';

type Props = {
  highlightedResume: string;
  signalReport: SignalReport;
  resumeOutOfDate: boolean;
};

function benchmarkColor(value: number, goodThreshold: number, warnThreshold: number): string {
  if (value >= goodThreshold) return 'text-[hsl(var(--foam))]';
  if (value >= warnThreshold) return 'text-[hsl(var(--gold))]';
  return 'text-[hsl(var(--love))]';
}

function benchmarkLabel(value: number, goodThreshold: number, warnThreshold: number): string {
  if (value >= goodThreshold) return 'Good';
  if (value >= warnThreshold) return 'Warning';
  return 'Needs work';
}

export default function ScanResults({ highlightedResume, signalReport, resumeOutOfDate }: Props) {
  const grade = signalGrade(signalReport.visible);
  const hasSkills = signalReport.hardSkills.length > 0 || signalReport.softSkills.length > 0;
  const hasSections = signalReport.sections.length > 0;
  const [deepOpen, setDeepOpen] = React.useState(false);

  const hasDeepData =
    signalReport.benchmarkScore !== undefined ||
    signalReport.weakWordCount !== undefined ||
    signalReport.impactCoverage !== undefined ||
    (signalReport.keywordDensity && signalReport.keywordDensity.length > 0) ||
    (signalReport.repetitiveVerbs && signalReport.repetitiveVerbs.length > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
      <Card className="backdrop-blur-lg">
        <CardHeader>
          <CardTitle className="text-xl">Analysis visualization</CardTitle>
          {resumeOutOfDate && (
            <p className="text-xs text-[hsl(var(--gold))]">Resume updated — rerun analysis to refresh metrics.</p>
          )}
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <mark className="rounded bg-[hsl(var(--primary)/0.3)] px-1 text-[hsl(var(--primary-foreground))]">Numbers</mark>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <mark className="rounded bg-[hsl(var(--love)/0.3)] px-1 text-[hsl(var(--love-foreground))]">Power Verbs</mark>
            </span>
          </div>
          <div
            className="min-h-[200px] rounded-2xl border border-[hsl(var(--border)/0.4)] bg-[hsl(var(--card)/0.65)] p-6 text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: highlightedResume.replace(/\n/g, '<br/>') }}
          />
        </CardContent>
      </Card>

      <Card className="backdrop-blur-lg">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Signal report</CardTitle>
            <div className={`text-4xl font-bold ${grade.color}`} aria-label={`Grade: ${grade.grade}`}>
              {grade.grade}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {grade.label}. Based on {signalReport.bulletCount} bullets scanned.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Signal strength */}
          <div>
            <div className="mb-2 flex justify-between text-xs text-muted-foreground">
              <span>Signal strength</span>
              <span className={signalReport.visible >= 70 ? 'text-[hsl(var(--love))]' : 'text-[hsl(var(--gold))]'}>
                {signalReport.visible}%
              </span>
            </div>
            <div
              className="h-2.5 w-full overflow-hidden rounded-full border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.25)]"
              role="progressbar"
              aria-valuenow={signalReport.visible}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Resume signal strength"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--foam))] via-[hsl(var(--iris))] to-[hsl(var(--love))]"
                style={{ width: `${signalReport.visible}%` }}
              />
            </div>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 gap-3 text-center text-sm">
            <div className="rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.45)] p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Numbers</p>
              <p className="text-3xl font-semibold text-[hsl(var(--foam))]">{signalReport.numbers}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">Quantified</p>
            </div>
            <div className="rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.45)] p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Power verbs</p>
              <p className="text-3xl font-semibold text-[hsl(var(--iris))]">{signalReport.verbs}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">Detected</p>
            </div>
          </div>

          {/* Resume length */}
          {signalReport.wordCount > 0 && (
            <div className="rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.3)] p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Resume length</p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
                <div>
                  <p className="text-lg font-semibold text-foreground">{signalReport.wordCount}</p>
                  <p className="text-[10px] text-muted-foreground">Words</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{signalReport.estimatedPages}</p>
                  <p className="text-[10px] text-muted-foreground">Est. pages</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{signalReport.bulletCount}</p>
                  <p className="text-[10px] text-muted-foreground">Bullets</p>
                </div>
              </div>
              <p className={`mt-2 text-xs ${signalReport.isOptimalLength ? 'text-[hsl(var(--love))]' : 'text-[hsl(var(--gold))]'}`}>
                {signalReport.lengthRecommendation}
              </p>
            </div>
          )}

          {/* Sections detected */}
          {hasSections && (
            <div className="rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.3)] p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Sections detected</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {signalReport.sections.map((section) => (
                  <span
                    key={section}
                    className="rounded-full border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.4)] px-2.5 py-1 text-xs capitalize text-muted-foreground"
                  >
                    {section}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Skills found */}
          {hasSkills && (
            <div className="rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.3)] p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Skills found</p>
              {signalReport.hardSkills.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Hard</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {signalReport.hardSkills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-[hsl(var(--foam)/0.15)] px-2 py-0.5 text-xs text-[hsl(var(--foam))]"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {signalReport.softSkills.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Soft</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {signalReport.softSkills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-[hsl(var(--iris)/0.15)] px-2 py-0.5 text-xs text-[hsl(var(--iris))]"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Next steps */}
          <div className="rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.3)] p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Next steps</p>
            <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              {signalReport.numbers < 5 && signalReport.bulletCount > 0 && (
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-[hsl(var(--gold))]">+</span>
                  <span>Add 2-3 more quantified metrics (%, $, #) to bullets without numbers.</span>
                </li>
              )}
              {signalReport.verbs < signalReport.bulletCount && (
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-[hsl(var(--gold))]">+</span>
                  <span>Replace weak verbs with stronger action words in the editor below.</span>
                </li>
              )}
              {signalReport.sections.length < 3 && (
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-[hsl(var(--gold))]">+</span>
                  <span>Make sure your resume has clear Experience, Education, and Skills sections.</span>
                </li>
              )}
              {signalReport.hardSkills.length < 3 && (
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-[hsl(var(--gold))]">+</span>
                  <span>Add more hard skills (tools, languages, frameworks) for ATS visibility.</span>
                </li>
              )}
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-[hsl(var(--foam))]">+</span>
                <span>Select any bullet on the left to edit and watch your score update.</span>
              </li>
            </ul>
          </div>

          {/* Deep Analysis */}
          {hasDeepData && (
            <div className="rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.3)] p-4">
              <button
                type="button"
                onClick={() => setDeepOpen((prev) => !prev)}
                className="flex w-full items-center justify-between text-left"
                aria-expanded={deepOpen}
              >
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Deep Analysis</p>
                <span className="text-lg text-muted-foreground">{deepOpen ? '−' : '+'}</span>
              </button>

              {deepOpen && (
                <div className="mt-4 space-y-4">
                  {/* Resume Health Score */}
                  {signalReport.benchmarkScore !== undefined && (
                    <div className="rounded-xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.4)] p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Resume Health Score</p>
                        <span
                          className={`text-2xl font-bold ${
                            (signalReport.benchmarkScore ?? 0) >= 80
                              ? 'text-[hsl(var(--foam))]'
                              : (signalReport.benchmarkScore ?? 0) >= 50
                                ? 'text-[hsl(var(--gold))]'
                                : 'text-[hsl(var(--love))]'
                          }`}
                        >
                          {signalReport.benchmarkScore}
                        </span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.25)]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--love))] via-[hsl(var(--gold))] to-[hsl(var(--foam))]"
                          style={{ width: `${signalReport.benchmarkScore}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Benchmark grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Numbers coverage */}
                    <div className="rounded-xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.4)] p-3 text-center">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Bullets with numbers</p>
                      <p
                        className={`text-xl font-semibold ${benchmarkColor(
                          signalReport.quantifiedBulletPercent ?? 0,
                          70,
                          50
                        )}`}
                      >
                        {signalReport.quantifiedBulletPercent ?? 0}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">Target: 70%+</p>
                    </div>

                    {/* Unique verbs */}
                    <div className="rounded-xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.4)] p-3 text-center">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Unique strong verbs</p>
                      <p
                        className={`text-xl font-semibold ${benchmarkColor(
                          signalReport.uniqueVerbCount ?? 0,
                          8,
                          5
                        )}`}
                      >
                        {signalReport.uniqueVerbCount ?? 0}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Target: 8+</p>
                    </div>

                    {/* Avg bullet length */}
                    <div className="rounded-xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.4)] p-3 text-center">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Avg bullet length</p>
                      <p
                        className={`text-xl font-semibold ${
                          (signalReport.avgBulletLength ?? 0) <= 30
                            ? 'text-[hsl(var(--foam))]'
                            : (signalReport.avgBulletLength ?? 0) <= 40
                              ? 'text-[hsl(var(--gold))]'
                              : 'text-[hsl(var(--love))]'
                        }`}
                      >
                        {signalReport.avgBulletLength ?? 0}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Target: {'<'}30 words</p>
                    </div>

                    {/* Passive voice */}
                    <div className="rounded-xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.4)] p-3 text-center">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Passive voice</p>
                      <p
                        className={`text-xl font-semibold ${
                          (signalReport.passiveVoicePercent ?? 0) === 0
                            ? 'text-[hsl(var(--foam))]'
                            : (signalReport.passiveVoicePercent ?? 0) <= 20
                              ? 'text-[hsl(var(--gold))]'
                              : 'text-[hsl(var(--love))]'
                        }`}
                      >
                        {signalReport.passiveVoicePercent ?? 0}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">Target: 0%</p>
                    </div>
                  </div>

                  {/* Weak words */}
                  {(signalReport.weakWordCount ?? 0) > 0 && (
                    <div className="rounded-xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.4)] p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Weak / Hedging Words</p>
                        <span className="text-lg font-semibold text-[hsl(var(--love))]">
                          {signalReport.weakWordCount}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {benchmarkLabel((signalReport.weakWordCount ?? 0) <= 3 ? 1 : 0, 1, 0)}
                      </p>
                    </div>
                  )}

                  {/* Repetitive verbs */}
                  {signalReport.repetitiveVerbs && signalReport.repetitiveVerbs.length > 0 && (
                    <div className="rounded-xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.4)] p-4">
                      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Repetitive Verbs</p>
                      <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                        {signalReport.repetitiveVerbs.map((rv) => {
                          const suggestion = suggestStrongerVerb(rv.verb);
                          return (
                            <li key={rv.verb} className="flex items-start gap-2">
                              <span className="mt-0.5 text-[hsl(var(--gold))]">!</span>
                              <span>
                                <span className="font-medium capitalize text-foreground">{rv.verb}</span> used{' '}
                                {rv.count}x.{' '}
                                {suggestion ? (
                                  <span>
                                    Try alternating with: <span className="text-[hsl(var(--foam))]">{suggestion}</span>
                                  </span>
                                ) : (
                                  'Try varying your language with stronger alternatives.'
                                )}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {/* Impact coverage */}
                  {signalReport.impactCoverage !== undefined && (
                    <div className="rounded-xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.4)] p-4">
                      <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                        <span>Impact coverage</span>
                        <span
                          className={benchmarkColor(signalReport.impactCoverage, 70, 50)}
                        >
                          {signalReport.impactCoverage}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.25)]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--love))] via-[hsl(var(--gold))] to-[hsl(var(--foam))]"
                          style={{ width: `${signalReport.impactCoverage}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Bullets with business outcomes, scope signals, or qualitative impact.
                      </p>
                    </div>
                  )}

                  {/* Keyword density */}
                  {signalReport.keywordDensity && signalReport.keywordDensity.length > 0 && (
                    <div className="rounded-xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.4)] p-4">
                      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Keyword Density</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {signalReport.keywordDensity.map((kw) => (
                          <span
                            key={kw.word}
                            className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.4)] px-2.5 py-1 text-xs text-muted-foreground"
                          >
                            <span>{kw.word}</span>
                            <span className="rounded-full bg-[hsl(var(--primary)/0.15)] px-1.5 py-0.5 text-[10px] text-[hsl(var(--primary))]">
                              {kw.count}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
