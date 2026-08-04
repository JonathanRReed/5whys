import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { BulletRecord } from '../../lib/resume-game';

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
        <CardTitle className="text-2xl">Before / After view</CardTitle>
        <p className="text-xs text-muted-foreground">
          Bullets whose wording actually changed, with the real score difference.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {rewritten.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.15)] p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No rewrites yet. Select a bullet above and change the verb, task, outcome, or number
              fields. Rewrites that change the wording show up here.
            </p>
          </div>
        ) : (
          rewritten.map((bullet) => {
            const index = bullets.indexOf(bullet);
            const delta = bullet.improvedScore - bullet.baselineScore;
            return (
              <div key={bullet.id} className="space-y-2">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  Bullet {index + 1}: {delta > 0 ? '+' : ''}
                  {delta} pts
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-[hsl(var(--destructive)/0.25)] bg-[hsl(var(--destructive)/0.04)] p-4 text-sm text-muted-foreground">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
                      Before
                    </p>
                    <p className="opacity-70">• {bullet.original}</p>
                  </div>
                  <div className="rounded-2xl border border-[hsl(var(--love)/0.4)] bg-[hsl(var(--love)/0.06)] p-4 text-sm text-foreground font-medium">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--love))] mb-2">
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
            {unchangedCount} {unchangedCount === 1 ? 'bullet is' : 'bullets are'} unchanged. Edit
            them in the structured rewrite to see a comparison here.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
