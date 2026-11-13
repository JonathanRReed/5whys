import * as React from 'react';
import { GLOSSARY, type GlossaryKey } from '../../lib/glossary';
import { cn } from '../../lib/utils';

/**
 * "Words on this page": the terms a first-time visitor may not know, each a
 * button that shows one plain sentence under the row. It sits where the
 * words are used, for the people who never open the guide.
 */
export default function WordHelp({
  words,
  className,
}: {
  words: readonly GlossaryKey[];
  className?: string;
}) {
  const [open, setOpen] = React.useState<GlossaryKey | null>(null);
  const id = React.useId();
  return (
    <div className={cn('space-y-2', className)} data-word-help>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted-foreground">
        <span>New word? Press it:</span>
        {words.map((word) => (
          <button
            key={word}
            type="button"
            aria-expanded={open === word}
            aria-controls={id}
            onClick={() => setOpen((current) => (current === word ? null : word))}
            className={cn(
              'inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border px-3 py-0.5 text-left text-sm transition-colors',
              'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
              open === word
                ? 'border-foam bg-foam/12 text-foreground'
                : 'border-border/60 text-foreground hover:border-foam/70'
            )}
          >
            {GLOSSARY[word].term}
            <span aria-hidden="true" className="text-xs text-muted-foreground">
              ?
            </span>
          </button>
        ))}
      </div>
      <p
        id={id}
        role="note"
        hidden={open === null}
        className="rounded-lg border border-border/50 bg-overlay/30 px-3 py-2 text-sm leading-relaxed text-foreground"
      >
        {open && (
          <>
            <span className="font-medium">{GLOSSARY[open].term}:</span> {GLOSSARY[open].means}
          </>
        )}
      </p>
    </div>
  );
}
