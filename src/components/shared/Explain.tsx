import * as React from 'react';
import { GLOSSARY, type GlossaryKey } from '../../lib/glossary';
import { cn } from '../../lib/utils';

/**
 * A small "?" beside a word a visitor may not know. Pressing it shows one
 * plain sentence in place, under the line it sits in. It is for the people
 * who skip the guide: help at the moment the word is in the way.
 *
 * It is a disclosure, not a tooltip, so it works by touch and by keyboard
 * and never covers what is being read.
 */
export default function Explain({ word, className }: { word: GlossaryKey; className?: string }) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  const entry = GLOSSARY[word];
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`What does "${entry.term}" mean?`}
        onClick={() => setOpen((value) => !value)}
        data-explain={word}
        className={cn(
          'relative mx-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border/70 align-middle font-sans text-[0.7rem] font-semibold leading-none text-muted-foreground transition-colors',
          // A finger needs more than the circle it sees.
          'before:absolute before:-inset-2.5 before:content-[""]',
          'hover:border-foam hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
          open && 'border-foam bg-foam/15 text-foreground',
          className
        )}
      >
        <span aria-hidden="true">?</span>
      </button>
      <span
        id={id}
        role="note"
        hidden={!open}
        className="mt-1.5 block rounded-lg border border-border/50 bg-overlay/30 px-3 py-2 font-sans text-sm font-normal normal-case leading-relaxed tracking-normal text-foreground"
      >
        <span className="font-medium">{entry.term}:</span> {entry.means}
      </span>
    </>
  );
}
