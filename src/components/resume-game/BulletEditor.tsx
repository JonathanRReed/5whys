import { isStudentLike, readProfile } from '../../lib/profile';
import type { BulletRecord } from '../../lib/resume-game';
import { generateBulletSuggestions } from '../../lib/resume-game';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

type Props = {
  bullet: BulletRecord | null;
  onFieldChange: (
    id: string,
    field: 'verb' | 'quantifier' | 'task' | 'impact',
    value: string
  ) => void;
};

export default function BulletEditor({ bullet, onFieldChange }: Props) {
  const register = isStudentLike(readProfile()) ? 'student' : 'professional';
  const suggestions = bullet ? generateBulletSuggestions(bullet) : [];
  // Hints pulled from the user's own text: if their line already contains a
  // number, surface it as the quantifier candidate.
  const detectedNumber = bullet?.original.match(/\$?\d[\d,]*\.?\d*%?/)?.[0] ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Structured rewrite</CardTitle>
        {bullet && (
          <p className="text-xs text-muted-foreground">
            {bullet.edited
              ? `Started at ${bullet.baselineScore}/100, now ${bullet.improvedScore}/100`
              : `Scores ${bullet.baselineScore}/100 as written. Fill a field to see it move.`}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {bullet ? (
          <>
            {/* Suggestions */}
            {suggestions.length > 0 ? (
              <div className="rounded-2xl border border-gold/40 bg-gold/8 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-gold">Suggestions</p>
                <ul className="mt-2 space-y-3">
                  {suggestions.map((suggestion, idx) => (
                    <li key={idx} className="space-y-1.5 text-sm text-muted-foreground">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 text-gold">+</span>
                        <span>
                          {suggestion.message}
                          {suggestion.fix && (
                            <span className="ml-1 text-foam">{suggestion.fix}</span>
                          )}
                        </span>
                      </div>
                      {(suggestion.studentExample || suggestion.professionalExample) && (
                        <div className="ml-6 space-y-1 border-l border-border/40 pl-3 text-xs">
                          {suggestion.studentExample && register === 'student' && (
                            <p>
                              <span className="mr-1 uppercase tracking-wide text-gold">
                                Student
                              </span>
                              {suggestion.studentExample}
                            </p>
                          )}
                          {suggestion.professionalExample && register === 'professional' && (
                            <p>
                              <span className="mr-1 uppercase tracking-wide text-gold">Pro</span>
                              {suggestion.professionalExample}
                            </p>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-2xl border border-border/35 bg-overlay/30 p-4">
                <p className="text-sm text-muted-foreground">
                  No flags. This line has an action verb, a number, and an outcome. Read it out loud
                  once; if it still sounds like your work, it is done.
                </p>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label
                  htmlFor={`bullet-${bullet.id}-verb`}
                  className="text-xs uppercase tracking-[0.3em] text-muted-foreground"
                >
                  Action verb (first word)
                </Label>
                <Input
                  id={`bullet-${bullet.id}-verb`}
                  value={bullet.fields.verb}
                  onChange={(event) => onFieldChange(bullet.id, 'verb', event.target.value)}
                  className="mt-2 border-border/50 bg-overlay/30 text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
                  placeholder="e.g., Led, Built, Increased"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  The action you took. Should be strong and specific.
                </p>
              </div>
              <div>
                <Label
                  htmlFor={`bullet-${bullet.id}-quantifier`}
                  className="text-xs uppercase tracking-[0.3em] text-muted-foreground"
                >
                  Measurable result (number)
                </Label>
                <Input
                  id={`bullet-${bullet.id}-quantifier`}
                  value={bullet.fields.quantifier}
                  onChange={(event) => onFieldChange(bullet.id, 'quantifier', event.target.value)}
                  className="mt-2 border-border/50 bg-overlay/30 text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
                  placeholder={
                    detectedNumber
                      ? `From your line: ${detectedNumber}`
                      : 'e.g., 32%, 120 users, $500K'
                  }
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {detectedNumber && !bullet.fields.quantifier.trim()
                    ? `Your line mentions ${detectedNumber}. Use it here so it lands where readers look.`
                    : 'A number that proves impact: percentage, count, or dollar amount. No number? Use team size, frequency, or audience.'}
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label
                  htmlFor={`bullet-${bullet.id}-task`}
                  className="text-xs uppercase tracking-[0.3em] text-muted-foreground"
                >
                  What you did
                </Label>
                <Textarea
                  id={`bullet-${bullet.id}-task`}
                  value={bullet.fields.task}
                  onChange={(event) => onFieldChange(bullet.id, 'task', event.target.value)}
                  className="mt-2 min-h-[100px] border-border/50 bg-overlay/30 text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
                  placeholder="e.g., a cross-functional team to launch a new dashboard"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  The work itself. Don&apos;t repeat the verb here.
                </p>
              </div>
              <div>
                <Label
                  htmlFor={`bullet-${bullet.id}-impact`}
                  className="text-xs uppercase tracking-[0.3em] text-muted-foreground"
                >
                  Result
                </Label>
                <Textarea
                  id={`bullet-${bullet.id}-impact`}
                  value={bullet.fields.impact}
                  onChange={(event) => onFieldChange(bullet.id, 'impact', event.target.value)}
                  className="mt-2 min-h-[100px] border-border/50 bg-overlay/30 text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
                  placeholder="e.g., to increase adoption by 40% in Q1"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  The result. Start with &quot;to&quot; or &quot;by&quot; to connect to the action.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-border/35 bg-overlay/30 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Live preview
              </p>
              <p className="mt-3 text-base">{bullet.improved}</p>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[240px] text-center">
            <p className="text-sm text-muted-foreground mb-2">No bullet selected</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Select a bullet from the list on the left to edit its verb, quantifier, task, and
              impact. Your changes update the score in real time.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
