import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { BulletRecord } from '../../lib/resume-game';

type Props = {
  bullets: BulletRecord[];
};

export default function BeforeAfter({ bullets }: Props) {
  return (
    <Card className="backdrop-blur-lg">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl">Before / After view</CardTitle>
        <p className="text-xs text-muted-foreground">High-signal rewrite preview.</p>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Before</p>
          <div className="space-y-3 rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.35)] p-5 text-sm text-muted-foreground">
            {bullets.map((bullet) => (
              <p key={`${bullet.id}-before`}>• {bullet.original}</p>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">After</p>
          <div className="space-y-3 rounded-2xl border border-[hsl(var(--foam)/0.5)] bg-[hsl(var(--foam)/0.1)] p-5 text-sm text-[hsl(var(--foreground))]">
            {bullets.map((bullet) => (
              <p key={`${bullet.id}-after`}>{bullet.improved}</p>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
