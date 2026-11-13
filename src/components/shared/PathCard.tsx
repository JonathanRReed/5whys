import * as React from 'react';
import {
  type CareerPath,
  endPath,
  loadPath,
  PATH_STORAGE_KEY,
  PATHS,
  type PathId,
  type PathProgress,
  pathProgress,
  startPath,
} from '../../lib/path';
import { cn } from '../../lib/utils';

/**
 * The guided path: the tools for one situation, in order, each opened with
 * its guide on. With `offer` it proposes that path (the career review);
 * without it, it shows the path the visitor is on, or nothing.
 */
export default function PathCard({ offer, className }: { offer?: PathId; className?: string }) {
  // Hydrate from empty state: the saved path is read after mount.
  const [active, setActive] = React.useState<CareerPath | null>(null);
  const [progress, setProgress] = React.useState<PathProgress | null>(null);
  React.useEffect(() => {
    const read = () => {
      const saved = loadPath();
      setActive(saved);
      const shown = offer ? PATHS[offer] : saved;
      setProgress(shown ? pathProgress(shown) : null);
    };
    read();
    // Another tab, or a guide finished there, changes what is done.
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === PATH_STORAGE_KEY || event.key.includes('guide')) {
        read();
      }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', read);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', read);
    };
  }, [offer]);

  const path = offer ? PATHS[offer] : active;
  if (!path) return null;
  const done = progress?.done ?? path.stops.map(() => false);
  const next = progress ? progress.next : path.stops[0];
  const onThisPath = active?.id === path.id;
  const finished = next === null;
  const doneCount = done.filter(Boolean).length;

  return (
    <section
      aria-labelledby="path-title"
      data-testid="path-card"
      className={cn('space-y-4 rounded-2xl border border-foam/45 bg-foam/6 p-5 sm:p-6', className)}
    >
      <div className="space-y-1">
        <p className="eyebrow">{onThisPath ? 'Your guided path' : 'Guided path'}</p>
        <h2 id="path-title" className="font-display text-xl font-semibold text-foreground">
          {path.title}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {finished
            ? 'You have been through every stop. Your work is on the dashboard.'
            : onThisPath
              ? `${doneCount} of ${path.stops.length} stops done. Each one opens with a guide that shows you where to press.`
              : `${path.stops.length} stops, one tool each. A guide walks you through every stop and then takes you to the next one.`}
        </p>
      </div>
      <ol className="space-y-2">
        {path.stops.map((item, index) => (
          <li key={item.tool} className="flex items-start gap-3 text-sm">
            <span
              className={cn(
                'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                done[index]
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border/60 text-foreground'
              )}
              aria-hidden="true"
            >
              {done[index] ? '✓' : index + 1}
            </span>
            <span className="min-w-0">
              <span className="block font-medium text-foreground">
                {item.label}
                <span className="sr-only">{done[index] ? ', done' : ''}</span>
              </span>
              <span className="block text-muted-foreground">{item.gain}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        {finished ? (
          <a
            href="/dashboard/"
            className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Open the dashboard
          </a>
        ) : offer && !(onThisPath && doneCount > 0) ? (
          <p className="text-sm text-foreground">
            "Start now" above opens the first stop with its guide on.
          </p>
        ) : (
          <a
            href={next?.href}
            onClick={() => startPath(path.id)}
            className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Continue the path
          </a>
        )}
        {onThisPath && (
          <button
            type="button"
            onClick={() => {
              endPath();
              setActive(null);
              if (!offer) setProgress(null);
            }}
            className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            Leave the path
          </button>
        )}
      </div>
    </section>
  );
}
