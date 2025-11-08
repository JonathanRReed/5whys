import * as React from 'react';

import { cn } from '../lib/utils';

type QuickStartItem = {
  title: string;
  body: string;
};

type QuickStartTilesProps = {
  items: QuickStartItem[];
  className?: string;
  accentClassName?: string;
};

const BASE_GRID_CLASSES = 'mx-auto grid gap-3 text-left sm:grid-cols-3';

export default function QuickStartTiles({
  items,
  className,
  accentClassName = 'text-[hsl(var(--foam))]',
}: QuickStartTilesProps) {
  if (!items.length) return null;

  return (
    <div className={cn(BASE_GRID_CLASSES, className)}>
      {items.map((item) => (
        <div
          key={item.title}
          className="rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.22)] p-4 text-sm text-[hsl(var(--muted-foreground))]"
        >
          <p className={cn('text-xs font-semibold uppercase tracking-[0.28em]', accentClassName)}>{item.title}</p>
          <p className="mt-2 leading-relaxed">{item.body}</p>
        </div>
      ))}
    </div>
  );
}

export type { QuickStartItem, QuickStartTilesProps };
