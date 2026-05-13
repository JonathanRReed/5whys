import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { generateBulletSuggestions } from '../../lib/resume-game';
import type { BulletRecord } from '../../lib/resume-game';

type Props = {
  bullet: BulletRecord | null;
  onFieldChange: (
    id: string,
    field: 'verb' | 'quantifier' | 'task' | 'impact',
    value: string
  ) => void;
};

export default function BulletEditor({ bullet, onFieldChange }: Props) {
  const suggestions = bullet ? generateBulletSuggestions(bullet) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Structured rewrite</CardTitle>
        {bullet && (
          <p className="text-xs text-muted-foreground">
            Baseline {bullet.baselineScore}/100 &rarr; {bullet.improvedScore}/100
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {bullet ? (
          <>
            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="rounded-2xl border border-[hsl(var(--gold)/0.4)] bg-[hsl(var(--gold)/0.08)] p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--gold))]">
                  Suggestions
                </p>
                <ul className="mt-2 space-y-2">
                  {suggestions.map((suggestion, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-0.5 text-[hsl(var(--gold))]">+</span>
                      <span>
                        {suggestion.message}
                        {suggestion.fix && (
                          <span className="ml-1 text-[hsl(var(--foam))]">{suggestion.fix}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label
                  htmlFor={`bullet-${bullet.id}-verb`}
                  className="text-xs uppercase tracking-[0.3em] text-muted-foreground"
                >
                  Power verb (first word)
                </Label>
                <Input
                  id={`bullet-${bullet.id}-verb`}
                  value={bullet.fields.verb}
                  onChange={(event) => onFieldChange(bullet.id, 'verb', event.target.value)}
                  className="mt-2 border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
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
                  className="mt-2 border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
                  placeholder="e.g., 32%, 120 users, $500K"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  A number that proves impact: percentage, count, or dollar amount.
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
                  className="mt-2 min-h-[100px] border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
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
                  Business outcome
                </Label>
                <Textarea
                  id={`bullet-${bullet.id}-impact`}
                  value={bullet.fields.impact}
                  onChange={(event) => onFieldChange(bullet.id, 'impact', event.target.value)}
                  className="mt-2 min-h-[100px] border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
                  placeholder="e.g., to increase adoption by 40% in Q1"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  The result. Start with &quot;to&quot; or &quot;by&quot; to connect to the action.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.3)] p-4">
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
