import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { scoreLabel } from '../../lib/resume-game';
import { cn } from '../../lib/utils';
import type { BulletRecord } from '../../lib/resume-game';

type Props = {
  bullets: BulletRecord[];
  selectedBulletId: string | null;
  onSelect: (id: string) => void;
};

export default function BulletList({ bullets, selectedBulletId, onSelect }: Props) {
  return (
    <Card className="backdrop-blur-lg">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Bullets</CardTitle>
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Select to rewrite</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {bullets.map((bullet) => {
          const delta = bullet.improvedScore - bullet.baselineScore;
          const label = scoreLabel(bullet.improvedScore);
          return (
            <button
              key={bullet.id}
              type="button"
              className={cn(
                'w-full rounded-2xl border px-4 py-3 text-left transition',
                bullet.id === selectedBulletId
                  ? 'border-[hsl(var(--foam)/0.8)] bg-[hsl(var(--foam)/0.16)] shadow-[0_0_30px_hsl(var(--foam)/0.25)]'
                  : 'border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.35)] hover:border-[hsl(var(--border)/0.5)]'
              )}
              onClick={() => onSelect(bullet.id)}
            >
              <p
                className="overflow-hidden text-sm text-[hsl(var(--foreground))]"
                style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}
              >
                {bullet.original}
              </p>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span className={label.color}>{label.label}</span>
                <span className={delta >= 0 ? 'text-[hsl(var(--love))]' : 'text-[hsl(var(--destructive))]'}>
                  {delta >= 0 ? '+' : ''}
                  {delta}
                </span>
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
