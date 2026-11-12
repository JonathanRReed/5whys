import type { BulletRecord, Register } from '../../lib/resume-game';
import {
  FIELD_PLACEHOLDERS,
  findMeasures,
  generateBulletSuggestions,
  measureHasWords,
  PART_LABELS,
  scoreParts,
} from '../../lib/resume-game';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import RewriteHelp from './RewriteHelp';

type Props = {
  bullet: BulletRecord | null;
  /** Position in the bullet list; rotates the worked examples. */
  index?: number;
  /** Which worked examples and placeholders to show. Students by default. */
  register?: Register;
  onFieldChange: (
    id: string,
    field: 'verb' | 'quantifier' | 'task' | 'impact',
    value: string
  ) => void;
};

const fieldClass =
  'mt-2 border-border/50 bg-overlay/30 text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2';
const labelClass = 'text-xs uppercase tracking-[0.3em] text-muted-foreground';
const PART_KEYS = ['action', 'work', 'result', 'measure'] as const;

export default function BulletEditor({
  bullet,
  index,
  register = 'student',
  onFieldChange,
}: Props) {
  const suggestions = bullet ? generateBulletSuggestions(bullet, index ?? bullet.original) : [];
  const current = bullet ? bullet.improved || bullet.original : '';
  const parts = bullet ? scoreParts(current) : null;
  const placeholders = FIELD_PLACEHOLDERS[register];
  const typedNumber = bullet?.fields.quantifier.trim() ?? '';
  const lineMeasure = bullet ? findMeasures(bullet.original)[0] : undefined;
  const numberHint =
    typedNumber && !measureHasWords(typedNumber)
      ? `Say what ${typedNumber} counts, for example "${typedNumber} orders a shift". It joins the line once it does.`
      : lineMeasure && !typedNumber
        ? `Your line already counts "${lineMeasure}". Add another only if it is true.`
        : 'Only a number you know is true, with what it counts. Leave it empty if you do not have one.';

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
        {bullet && parts ? (
          <>
            <section aria-label="How this line scores" className="space-y-2">
              <p className={labelClass}>How this line scores</p>
              <ul className="space-y-1.5 text-sm">
                {PART_KEYS.map((key) => (
                  <li key={key} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium text-foreground">{PART_LABELS[key]}</span>
                    <span
                      className={
                        parts[key].points === parts[key].max ? 'text-love' : 'text-muted-foreground'
                      }
                    >
                      {parts[key].points} of {parts[key].max}
                    </span>
                    <span className="w-full text-xs text-muted-foreground">{parts[key].note}</span>
                  </li>
                ))}
              </ul>
            </section>

            {suggestions.length > 0 ? (
              <div className="rounded-2xl border border-gold/40 bg-gold/8 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-gold">Suggestions</p>
                <ul className="mt-2 space-y-3">
                  {suggestions.map((suggestion) => {
                    const example =
                      register === 'student' ? suggestion.studentExample : suggestion.workExample;
                    return (
                      <li
                        key={suggestion.type}
                        className="space-y-1.5 text-sm text-muted-foreground"
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 text-gold">+</span>
                          <span>
                            {suggestion.message}
                            {suggestion.fix && (
                              <span className="ml-1 text-foam">{suggestion.fix}</span>
                            )}
                          </span>
                        </div>
                        {example && (
                          <p className="ml-6 border-l border-border/40 pl-3 text-xs">
                            <span className="mr-1 uppercase tracking-wide text-gold">Example</span>
                            {example}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <div className="rounded-2xl border border-border/35 bg-overlay/30 p-4">
                <p className="text-sm text-muted-foreground">
                  No writing flags from this checklist. Read the line out loud, check that every
                  claim is accurate, and make sure it fits the role.
                </p>
              </div>
            )}

            <RewriteHelp line={current} />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor={`bullet-${bullet.id}-verb`} className={labelClass}>
                  What you did (first word)
                </Label>
                <Input
                  id={`bullet-${bullet.id}-verb`}
                  value={bullet.fields.verb}
                  onChange={(event) => onFieldChange(bullet.id, 'verb', event.target.value)}
                  className={fieldClass}
                  placeholder={placeholders.verb}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  The word for what you did yourself. It replaces the first word of the line.
                </p>
              </div>
              <div>
                <Label htmlFor={`bullet-${bullet.id}-quantifier`} className={labelClass}>
                  A number (optional)
                </Label>
                <Input
                  id={`bullet-${bullet.id}-quantifier`}
                  value={bullet.fields.quantifier}
                  onChange={(event) => onFieldChange(bullet.id, 'quantifier', event.target.value)}
                  className={fieldClass}
                  placeholder={placeholders.quantifier}
                />
                <p className="mt-1 text-xs text-muted-foreground">{numberHint}</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor={`bullet-${bullet.id}-task`} className={labelClass}>
                  What the work was
                </Label>
                <Textarea
                  id={`bullet-${bullet.id}-task`}
                  value={bullet.fields.task}
                  onChange={(event) => onFieldChange(bullet.id, 'task', event.target.value)}
                  className={`${fieldClass} min-h-[100px]`}
                  placeholder={placeholders.task}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  What it was, and where or for whom. Do not repeat the first word here.
                </p>
              </div>
              <div>
                <Label htmlFor={`bullet-${bullet.id}-impact`} className={labelClass}>
                  What happened because of it
                </Label>
                <Textarea
                  id={`bullet-${bullet.id}-impact`}
                  value={bullet.fields.impact}
                  onChange={(event) => onFieldChange(bullet.id, 'impact', event.target.value)}
                  className={`${fieldClass} min-h-[100px]`}
                  placeholder={placeholders.impact}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Write it the way you would say it. &quot;So customers waited less&quot; works.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-border/35 bg-overlay/30 p-4">
              <p className={labelClass}>Your line now</p>
              <p className="mt-3 text-base">{current}</p>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[240px] text-center">
            <p className="text-sm text-muted-foreground mb-2">No line selected</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Pick a line from the list to rewrite it one part at a time. The score updates as you
              type.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
