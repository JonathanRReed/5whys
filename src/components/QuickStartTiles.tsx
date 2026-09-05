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
  accentClassName = 'text-foam',
}: QuickStartTilesProps) {
  if (!items.length) return null;

  return (
    <div className={cn(BASE_GRID_CLASSES, className)}>
      {items.map((item) => (
        <div
          key={item.title}
          className="rounded-xl border border-border/50 bg-card/50 p-4 text-sm text-muted-foreground transition-colors duration-200 hover:border-foam/40"
        >
          <h3 className={cn('eyebrow', accentClassName)}>{item.title}</h3>
          <p className="mt-2.5 leading-relaxed">{item.body}</p>
        </div>
      ))}
    </div>
  );
}

export type { QuickStartItem, QuickStartTilesProps };
