import type { BulletRecord } from '../../lib/resume-game';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

type Props = {
  bullets: BulletRecord[];
};

// Normalize for comparison so formatting-only differences (bullet glyph,
// trailing period, casing, spacing) do not count as a rewrite.
function comparable(text: string): string {
  return text
    .replace(/^[-•*]\s*/, '')
    .replace(/[.!?]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export default function BeforeAfter({ bullets }: Props) {
  const rewritten = bullets.filter(
    (bullet) => comparable(bullet.improved) !== comparable(bullet.original)
  );
  const unchangedCount = bullets.length - rewritten.length;

  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl">Before and after</CardTitle>
        <p className="text-xs text-muted-foreground">
          Lines whose wording actually changed, with the real score difference.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {rewritten.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/35 bg-overlay/15 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No rewrites yet. Pick a line above and change one of its fields. Rewrites that change
              the wording show up here.
            </p>
          </div>
        ) : (
          rewritten.map((bullet) => {
            const index = bullets.indexOf(bullet);
            const delta = bullet.improvedScore - bullet.baselineScore;
            return (
              <div key={bullet.id} className="space-y-2">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  Line {index + 1}: {delta > 0 ? '+' : ''}
                  {delta} points
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-destructive/25 bg-destructive/4 p-4 text-sm text-muted-foreground">
                    <p className="text-[0.72rem] uppercase tracking-[0.2em] text-muted-foreground mb-2">
                      Before
                    </p>
                    <p className="opacity-70">{bullet.original}</p>
                  </div>
                  <div className="rounded-2xl border border-love/40 bg-love/6 p-4 text-sm text-foreground font-medium">
                    <p className="text-[0.72rem] uppercase tracking-[0.2em] text-love mb-2">
                      After
                    </p>
                    <p>{bullet.improved}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        {rewritten.length > 0 && unchangedCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {unchangedCount} {unchangedCount === 1 ? 'line is' : 'lines are'} unchanged. Edit them
            in the structured rewrite to see a comparison here.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
