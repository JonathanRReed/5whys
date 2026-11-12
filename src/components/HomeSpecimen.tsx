import * as React from 'react';
import {
  isSourceSpan,
  type PostingRequirement,
  type PostingSection,
  parsePosting,
  SAMPLE_POSTING,
} from '../lib/posting';
import { cn } from '../lib/utils';
import { withViewTransition } from '../lib/view-transition';

const LABEL: Record<PostingSection, string> = {
  required: 'Required',
  preferred: 'Preferred',
  responsibility: 'What you would do',
  unclassified: 'Not sorted yet',
};

const MARK: Record<PostingSection, string> = {
  required: 'bg-foam/25',
  preferred: 'bg-gold/25',
  responsibility: 'bg-iris/25',
  unclassified: 'bg-foreground/10',
};

const DOT: Record<PostingSection, string> = {
  required: 'bg-foam',
  preferred: 'bg-gold',
  responsibility: 'bg-iris',
  unclassified: 'bg-muted-foreground',
};

const SHOWN: PostingSection[] = ['required', 'preferred', 'responsibility'];

/**
 * The homepage's one working moment: a sample posting the visitor can sort
 * with a single press. It is the real posting engine, not a recording, so
 * what they see here is what the Application Desk does with their own.
 */
export default function HomeSpecimen() {
  const [requirements, setRequirements] = React.useState<PostingRequirement[] | null>(null);
  const [text, setText] = React.useState(SAMPLE_POSTING);
  // The button is server-rendered before this island loads. Until it is live
  // it says so, instead of swallowing a tap.
  const [live, setLive] = React.useState(false);
  React.useEffect(() => setLive(true), []);

  const sort = () => {
    const parsed = parsePosting(SAMPLE_POSTING);
    withViewTransition(() => {
      setText(parsed.text);
      setRequirements(parsed.requirements);
    });
  };

  const reset = () =>
    withViewTransition(() => {
      setRequirements(null);
      setText(SAMPLE_POSTING);
    });

  const marks = (requirements ?? [])
    .filter((r) => SHOWN.includes(r.section) && isSourceSpan(r.span, text))
    .sort((a, b) => (a.span?.start ?? 0) - (b.span?.start ?? 0));
  const pieces: React.ReactNode[] = [];
  let cursor = 0;
  for (const requirement of marks) {
    const span = requirement.span;
    if (!span || span.start < cursor) continue;
    if (span.start > cursor) pieces.push(text.slice(cursor, span.start));
    pieces.push(
      <mark
        key={requirement.id}
        className={cn('rounded-[3px] px-0.5 text-foreground', MARK[requirement.section])}
      >
        {text.slice(span.start, span.end)}
      </mark>
    );
    cursor = span.end;
  }
  if (cursor < text.length) pieces.push(text.slice(cursor));

  const counts = SHOWN.map((section) => ({
    section,
    count: marks.filter((r) => r.section === section).length,
  }));

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
      <div className="space-y-5 lg:sticky lg:top-28">
        <h2 className="text-3xl text-foreground sm:text-[2.4rem] sm:leading-[1.08]">
          A job posting is written in code. Sort it.
        </h2>
        <p className="max-w-[46ch] text-pretty text-base leading-relaxed text-muted-foreground">
          This is a made-up posting. Press the button and the same tool the Application Desk uses
          will sort what it asks for, right here on your device.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {requirements ? (
            <>
              <a
                href="/application/"
                className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                Do this with a real posting
              </a>
              <button
                type="button"
                onClick={reset}
                className="inline-flex min-h-11 items-center rounded-lg border border-border/60 px-4 text-sm transition-colors hover:bg-overlay/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                Put it back
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={sort}
              disabled={!live}
              className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              {live ? 'Sort what it asks for' : 'Getting ready'}
            </button>
          )}
        </div>
        <ul
          aria-live="polite"
          className={cn(
            'space-y-1.5 text-sm transition-opacity duration-300 motion-reduce:transition-none',
            requirements ? 'opacity-100' : 'opacity-0'
          )}
        >
          {requirements &&
            counts.map(({ section, count }) => (
              <li key={section} className="flex items-center gap-2 text-muted-foreground">
                <span className={cn('h-2 w-2 rounded-full', DOT[section])} aria-hidden="true" />
                <span className="font-mono tabular-nums text-foreground">{count}</span>
                {LABEL[section].toLowerCase()}
              </li>
            ))}
        </ul>
      </div>

      <div
        className="rounded-xl sm:max-h-[30rem] sm:overflow-y-auto border border-border/50 bg-card/60 p-5 text-sm leading-7 whitespace-pre-wrap sm:p-6"
        style={{ viewTransitionName: 'home-specimen' }}
        data-testid="home-specimen"
      >
        {pieces}
      </div>
    </div>
  );
}
