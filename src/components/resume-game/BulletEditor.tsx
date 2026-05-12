import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import type { BulletRecord } from '../../lib/resume-game';

type Props = {
  bullet: BulletRecord | null;
  onFieldChange: (id: string, field: 'verb' | 'quantifier' | 'task' | 'impact', value: string) => void;
};

export default function BulletEditor({ bullet, onFieldChange }: Props) {
  return (
    <Card className="backdrop-blur-lg">
      <CardHeader>
        <CardTitle className="text-xl">Structured rewrite</CardTitle>
        {bullet && (
          <p className="text-xs text-muted-foreground">
            Baseline {bullet.baselineScore}/100 → {bullet.improvedScore}/100
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {bullet ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor={`bullet-${bullet.id}-verb`} className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  Action verb
                </Label>
                <Input
                  id={`bullet-${bullet.id}-verb`}
                  value={bullet.fields.verb}
                  onChange={(event) => onFieldChange(bullet.id, 'verb', event.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor={`bullet-${bullet.id}-quantifier`} className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  Quantifier
                </Label>
                <Input
                  id={`bullet-${bullet.id}-quantifier`}
                  value={bullet.fields.quantifier}
                  onChange={(event) => onFieldChange(bullet.id, 'quantifier', event.target.value)}
                  className="mt-2"
                  placeholder="e.g., 32%, 120 users"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor={`bullet-${bullet.id}-task`} className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  Task / What you did
                </Label>
                <Textarea
                  id={`bullet-${bullet.id}-task`}
                  value={bullet.fields.task}
                  onChange={(event) => onFieldChange(bullet.id, 'task', event.target.value)}
                  className="mt-2 min-h-[100px]"
                />
              </div>
              <div>
                <Label htmlFor={`bullet-${bullet.id}-impact`} className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  Impact / Result
                </Label>
                <Textarea
                  id={`bullet-${bullet.id}-impact`}
                  value={bullet.fields.impact}
                  onChange={(event) => onFieldChange(bullet.id, 'impact', event.target.value)}
                  className="mt-2 min-h-[100px]"
                />
              </div>
            </div>
            <div className="rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.3)] p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Live preview</p>
              <p className="mt-3 text-base">{bullet.improved}</p>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Select a bullet on the left to edit.</p>
        )}
      </CardContent>
    </Card>
  );
}
