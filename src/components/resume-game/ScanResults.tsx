import * as React from 'react';
import type { BulletRecord, HighlightToken, SignalReport } from '../../lib/resume-game';
import {
  generateBulletSuggestions,
  parseHighlightedResume,
  summarizeLines,
  summarySentences,
} from '../../lib/resume-game';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

type Props = {
  bullets?: BulletRecord[];
  resumeText: string;
  signalReport: SignalReport;
  resumeOutOfDate: boolean;
};

function renderToken(token: HighlightToken, index: number) {
  if (token.type === 'newline') {
    return <br key={index} />;
  }
  if (token.type === 'number') {
    return (
      <mark key={index} className="rounded bg-primary/30 px-1 text-primary-foreground">
        {token.text}
      </mark>
    );
  }
  if (token.type === 'verb') {
    return (
      <mark key={index} className="rounded bg-love/30 px-1 text-foreground">
        {token.text}
      </mark>
    );
  }
  return <React.Fragment key={index}>{token.text}</React.Fragment>;
}

export default function ScanResults({
  bullets = [],
  resumeText,
  signalReport,
  resumeOutOfDate,
}: Props) {
  const nextSteps = bullets
    .map((bullet, index) => ({
      bullet,
      suggestion: generateBulletSuggestions(bullet, index)[0],
    }))
    .filter((item) => item.suggestion)
    .slice(0, 3);
  const hasSkills = signalReport.hardSkills.length > 0 || signalReport.softSkills.length > 0;
  const hasSections = signalReport.sections.length > 0;
  const [deepOpen, setDeepOpen] = React.useState(false);
  const deepAnalysisId = React.useId();

  const tokens = React.useMemo(() => parseHighlightedResume(resumeText), [resumeText]);

  const hasDeepData =
    (signalReport.weakWordCount ?? 0) > 0 ||
    (signalReport.keywordDensity && signalReport.keywordDensity.length > 0) ||
    (signalReport.repetitiveVerbs && signalReport.repetitiveVerbs.length > 0);

  // The resume as a whole is described in counts, read from each line as it
  // reads now. There is no resume-level score.
  const standing = summarySentences(
    summarizeLines(bullets.map((bullet) => bullet.improved || bullet.original))
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Your text, marked</CardTitle>
          {resumeOutOfDate && (
            <p className="text-xs text-gold">
              Resume updated. Rerun the analysis to refresh metrics.
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <mark className="rounded bg-primary/30 px-1 text-primary-foreground">Numbers</mark>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <mark className="rounded bg-love/30 px-1 text-foreground">Action verbs</mark>
            </span>
          </div>
          <div className="min-h-[200px] rounded-2xl border border-border/40 bg-card/65 p-6 text-sm leading-relaxed">
            {tokens.map(renderToken)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl">Resume review</CardTitle>
          <p className="text-sm text-muted-foreground">
            Each line is scored for what you did, what the work was, what happened because of it,
            and a number that says what it counts. A writing checklist, not a hiring prediction or a
            grade on your experience.
          </p>
          <p className="text-xs text-muted-foreground">
            These rules may miss skills, context, and valid ways of describing your work. Check the
            extracted lines before acting on a suggestion.
          </p>
          {signalReport.structureNote && (
            <p className="rounded-xl border border-border/35 bg-overlay/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              {signalReport.structureNote}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          {standing.length > 0 && (
            <section aria-label="Where your lines stand" className="space-y-2">
              <h3 className="text-base font-semibold">Where your lines stand</h3>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {standing.map((sentence) => (
                  <li key={sentence}>{sentence}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Resume length */}
          {signalReport.wordCount > 0 && (
            <div className="rounded-2xl border border-border/35 bg-overlay/30 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Resume length
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
                <div>
                  <p className="text-lg font-semibold text-foreground">{signalReport.wordCount}</p>
                  <p className="text-[10px] text-muted-foreground">Words</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    {signalReport.estimatedPages}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Est. pages</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    {signalReport.bulletCount}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Lines scored</p>
                </div>
              </div>
              <p
                className={`mt-2 text-xs ${signalReport.isOptimalLength ? 'text-love' : 'text-gold'}`}
              >
                {signalReport.lengthRecommendation}
              </p>
            </div>
          )}

          {/* Sections detected */}
          {hasSections && (
            <div className="rounded-2xl border border-border/35 bg-overlay/30 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Sections detected
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {signalReport.sections.map((section) => (
                  <span
                    key={section}
                    className="rounded-full border border-border/50 bg-overlay/40 px-2.5 py-1 text-xs capitalize text-muted-foreground"
                  >
                    {section}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Skills found */}
          {hasSkills && (
            <div className="rounded-2xl border border-border/35 bg-overlay/30 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Skills found
              </p>
              {signalReport.hardSkills.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Tools and methods
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {signalReport.hardSkills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-foam/15 px-2 py-0.5 text-xs text-foam"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {signalReport.softSkills.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Ways of working
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {signalReport.softSkills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-iris/15 px-2 py-0.5 text-xs text-iris"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <section
            aria-label="Your next steps"
            className="space-y-3 border-t border-border/40 pt-4"
          >
            <h3 className="text-lg">Your next steps</h3>
            {resumeOutOfDate ? (
              <p className="text-sm text-muted-foreground">
                Rerun the analysis before using feedback for the changed text.
              </p>
            ) : nextSteps.length > 0 ? (
              <ol className="space-y-4">
                {nextSteps.map(({ bullet, suggestion }) => (
                  <li key={bullet.id} className="space-y-1 text-sm">
                    <p className="font-medium text-foreground">{bullet.improved}</p>
                    <p className="text-muted-foreground">{suggestion.message}</p>
                    {suggestion.fix && <p className="text-muted-foreground">{suggestion.fix}</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">
                {bullets.length > 0
                  ? 'No obvious writing flags in the reviewed lines. Check relevance against the role and make sure every claim is accurate.'
                  : 'Review the detected achievement lines before relying on the checklist.'}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Suggestions come from limited writing rules. Keep the words your field uses, and never
              invent a number to satisfy the tool.
            </p>
          </section>

          {/* Deep Analysis */}
          {hasDeepData && (
            <div className="rounded-2xl border border-border/35 bg-overlay/30 p-4">
              <button
                type="button"
                onClick={() => setDeepOpen((prev) => !prev)}
                className="flex w-full items-center justify-between text-left"
                aria-expanded={deepOpen}
                aria-controls={deepAnalysisId}
              >
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  More detail
                </p>
                <span className="text-lg text-muted-foreground">{deepOpen ? '−' : '+'}</span>
              </button>

              <div id={deepAnalysisId} hidden={!deepOpen} className="mt-4 space-y-4">
                {/* Weak words */}
                {(signalReport.weakWordCount ?? 0) > 0 && (
                  <div className="rounded-xl border border-border/35 bg-overlay/40 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                        Hedging phrases
                      </p>
                      <span className="text-lg font-semibold text-love">
                        {signalReport.weakWordCount}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {(signalReport.weakWordCount ?? 0) <= 3
                        ? 'A few phrases like "responsible for" say you were there, not what you did.'
                        : 'Phrases like "responsible for" come up often. Start each line with what you did.'}
                    </p>
                  </div>
                )}

                {/* Repeated verbs */}
                {signalReport.repetitiveVerbs && signalReport.repetitiveVerbs.length > 0 && (
                  <div className="rounded-xl border border-border/35 bg-overlay/40 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                      Repeated first words
                    </p>
                    <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                      {signalReport.repetitiveVerbs.map((rv) => (
                        <li key={rv.verb}>
                          <span className="font-medium capitalize text-foreground">{rv.verb}</span>{' '}
                          starts {rv.count} lines. If the work was different each time, say what you
                          did differently.
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Keyword density */}
                {signalReport.keywordDensity && signalReport.keywordDensity.length > 0 && (
                  <div className="rounded-xl border border-border/35 bg-overlay/40 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                      Words you use most
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {signalReport.keywordDensity.map((kw) => (
                        <span
                          key={kw.word}
                          className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-overlay/40 px-2.5 py-1 text-xs text-muted-foreground"
                        >
                          <span>{kw.word}</span>
                          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                            {kw.count}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
