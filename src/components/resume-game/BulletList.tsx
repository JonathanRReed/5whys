import * as React from 'react';
import type { BulletRecord } from '../../lib/resume-game';
import { scoreLabel } from '../../lib/resume-game';
import { cn } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

type Props = {
  bullets: BulletRecord[];
  selectedBulletId: string | null;
  onSelect: (id: string) => void;
};

type ItemProps = {
  bullet: BulletRecord;
  isSelected: boolean;
  onSelect: (id: string) => void;
};

const BulletItem = React.memo(function BulletItem({ bullet, isSelected, onSelect }: ItemProps) {
  const delta = bullet.improvedScore - bullet.baselineScore;
  const label = scoreLabel(bullet.improvedScore);
  return (
    <button
      key={bullet.id}
      type="button"
      className={cn(
        'w-full rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2',
        isSelected
          ? 'border-foam/80 bg-foam/16 shadow-[0_0_30px_hsl(var(--foam)/0.25)]'
          : 'border-border/35 bg-overlay/35 hover:border-border/50'
      )}
      onClick={() => onSelect(bullet.id)}
      aria-pressed={isSelected}
      data-guide-improved={bullet.edited && delta > 0 ? '' : undefined}
    >
      <p
        className="overflow-hidden text-sm text-foreground"
        style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}
      >
        {/* The line as it reads now, so a rewritten card shows its new wording. */}
        {bullet.edited && bullet.improved ? bullet.improved : bullet.original}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className={label.color}>{label.label}</span>
        {bullet.edited && delta !== 0 ? (
          <span>
            {bullet.improvedScore}/100, from {bullet.baselineScore}
          </span>
        ) : (
          <span>{bullet.improvedScore}/100</span>
        )}
      </div>
    </button>
  );
});

export default React.memo(function BulletList({ bullets, selectedBulletId, onSelect }: Props) {
  return (
    <Card data-bullet-list>
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Your lines</CardTitle>
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Pick one to rewrite
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {bullets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/35 bg-overlay/15 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Run the analysis to find and score your lines.
            </p>
          </div>
        ) : (
          bullets.map((bullet) => (
            <BulletItem
              key={bullet.id}
              bullet={bullet}
              isSelected={bullet.id === selectedBulletId}
              onSelect={onSelect}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
});
