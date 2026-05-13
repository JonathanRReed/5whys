import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { BulletRecord } from '../../lib/resume-game';

type Props = {
  bullets: BulletRecord[];
};

export default function BeforeAfter({ bullets }: Props) {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl">Before / After view</CardTitle>
        <p className="text-xs text-muted-foreground">
          Side-by-side comparison of your original and improved bullets.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {bullets.map((bullet, index) => (
          <div key={bullet.id} className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Bullet {index + 1}: {bullet.improvedScore > bullet.baselineScore ? '+' : ''}
              {bullet.improvedScore - bullet.baselineScore} pts
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
        ))}
      </CardContent>
    </Card>
  );
}
