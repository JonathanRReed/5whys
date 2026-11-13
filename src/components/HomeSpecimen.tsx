import * as React from 'react';
import {
  findVaguePhrases,
  isSourceSpan,
  type PostingRequirement,
  type PostingSection,
  parsePosting,
  SAMPLE_POSTING,
} from '../lib/posting';
import { POSTING_HANDOFF_KEY } from '../lib/posting-handoff';
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

/** Each section's own underline, so the key does not depend on color alone. */
const LINE: Record<PostingSection, string> = {
  required: 'decoration-foam decoration-solid',
  preferred: 'decoration-gold decoration-dashed',
  responsibility: 'decoration-iris decoration-dotted',
  unclassified: 'decoration-muted-foreground decoration-double',
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
/** Enough for any real posting; keeps a pasted novel from stalling the page. */
const MAX_POSTING = 20_000;

export default function HomeSpecimen() {
  const [requirements, setRequirements] = React.useState<PostingRequirement[] | null>(null);
  const [text, setText] = React.useState(SAMPLE_POSTING);
  // The visitor's own posting, once they choose to paste one.
  const [own, setOwn] = React.useState<string | null>(null);
  const ownId = React.useId();
  // The button is server-rendered before this island loads. Until it is live
  // it says so, instead of swallowing a tap.
  const [live, setLive] = React.useState(false);
  React.useEffect(() => setLive(true), []);

  const source = own === null ? SAMPLE_POSTING : own.slice(0, MAX_POSTING);
  const sort = () => {
    if (!source.trim()) return;
    const parsed = parsePosting(source);
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

  /** Keep the pasted posting for the desk, in this tab only. */
  const carry = () => {
    if (own === null || !own.trim()) return;
    try {
      window.sessionStorage.setItem(POSTING_HANDOFF_KEY, own.slice(0, MAX_POSTING));
    } catch {
      // Storage is blocked: the desk opens empty and the posting is pasted again.
    }
  };

  // Phrases that sound like information and are not: each comes with a
  // question the visitor could ask the employer.
  const vague = React.useMemo(
    () => (requirements ? findVaguePhrases(text) : []),
    [requirements, text]
  );
  /** The text from `from` to `to`, with any vague phrase inside it marked. */
  const slice = (from: number, to: number): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    let at = from;
    for (const hit of vague) {
      if (hit.start < at || hit.end > to) continue;
      if (hit.start > at) nodes.push(text.slice(at, hit.start));
      nodes.push(
        <span
          key={`vague-${hit.start}`}
          className="underline decoration-madder decoration-wavy decoration-1 underline-offset-4"
        >
          <span className="sr-only">Worth asking about: </span>
          {text.slice(hit.start, hit.end)}
        </span>
      );
      at = hit.end;
    }
    if (at < to) nodes.push(text.slice(at, to));
    return nodes;
  };

  const marks = (requirements ?? [])
    .filter((r) => SHOWN.includes(r.section) && isSourceSpan(r.span, text))
    .sort((a, b) => (a.span?.start ?? 0) - (b.span?.start ?? 0));
  const pieces: React.ReactNode[] = [];
  let cursor = 0;
  for (const requirement of marks) {
    const span = requirement.span;
    if (!span || span.start < cursor) continue;
    if (span.start > cursor) pieces.push(...slice(cursor, span.start));
    pieces.push(
      <mark
        key={requirement.id}
        className={cn(
          'rounded-[3px] px-0.5 text-foreground underline underline-offset-4',
          MARK[requirement.section],
          LINE[requirement.section]
        )}
      >
        <span className="sr-only">{LABEL[requirement.section]}: </span>
        {slice(span.start, span.end)}
      </mark>
    );
    cursor = span.end;
  }
  if (cursor < text.length) pieces.push(...slice(cursor, text.length));
  // One question per phrase, in the order the posting uses them.
  const asks = [...new Map(vague.map((hit) => [hit.id, hit])).values()].slice(0, 4);

  const counts = SHOWN.map((section) => ({
    section,
    count: marks.filter((r) => r.section === section).length,
  }));

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
      <div className="space-y-5 lg:sticky lg:top-28">
        <h2 className="text-3xl text-foreground sm:text-[2.4rem] sm:leading-[1.08]">
          A job posting is written in code. Decode it.
        </h2>
        <p className="max-w-[46ch] text-pretty text-base leading-relaxed text-muted-foreground">
          {own === null
            ? 'This is a made-up posting. Press the button and the same tool the Application Desk uses will sort what it asks for and point out what it leaves unsaid, right here on your device.'
            : 'Paste a posting you are looking at. It is sorted on your device and goes nowhere.'}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {requirements ? (
            <>
              <a
                href="/application/"
                onClick={carry}
                className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                {own === null ? 'Do this with a real posting' : 'Take this posting to the desk'}
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
              disabled={!live || !source.trim()}
              className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              {live ? 'Decode this posting' : 'Getting ready'}
            </button>
          )}
          {!requirements && live && (
            <button
              type="button"
              onClick={() => setOwn((current) => (current === null ? '' : null))}
              className="inline-flex min-h-11 items-center rounded-lg border border-border/60 px-4 text-sm transition-colors hover:bg-overlay/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              {own === null ? 'Try your own posting' : 'Use the sample'}
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
                <span
                  className={cn('forced-fill h-2 w-2 rounded-full', DOT[section])}
                  aria-hidden="true"
                />
                <span className="font-mono tabular-nums text-foreground">{count}</span>
                <span className={cn('underline underline-offset-4', LINE[section])}>
                  {LABEL[section].toLowerCase()}
                </span>
              </li>
            ))}
        </ul>
        {asks.length > 0 && (
          <div className="space-y-2 border-t border-border/40 pt-4" data-testid="home-asks">
            <p className="text-sm font-medium text-foreground">
              <span className="underline decoration-madder decoration-wavy decoration-1 underline-offset-4">
                Worth asking about
              </span>
            </p>
            <ul className="space-y-2.5 text-sm">
              {asks.map((hit) => (
                <li key={hit.id} className="space-y-0.5">
                  <span className="block text-foreground">"{hit.text}"</span>
                  <span className="block leading-relaxed text-muted-foreground">
                    {hit.phrase.questions[0]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {own !== null && !requirements ? (
        <div className="space-y-2">
          <label htmlFor={ownId} className="block text-sm text-muted-foreground">
            Your posting
          </label>
          <textarea
            id={ownId}
            value={own}
            onChange={(event) => setOwn(event.target.value)}
            rows={14}
            maxLength={MAX_POSTING}
            placeholder="Paste the whole job description here."
            data-testid="home-own-posting"
            className="w-full rounded-xl border border-[hsl(var(--field-border))] bg-card/60 p-5 text-base leading-7 text-foreground placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      ) : (
        // Named, so a browser that puts the scroller in the Tab order announces it.
        <section
          aria-label={own === null ? 'Sample posting' : 'Your posting, sorted'}
          className="rounded-xl sm:max-h-[30rem] sm:overflow-y-auto border border-border/50 bg-card/60 p-5 text-sm leading-7 whitespace-pre-wrap sm:p-6"
          style={{ viewTransitionName: 'home-specimen' }}
          data-testid="home-specimen"
        >
          {pieces}
        </section>
      )}
    </div>
  );
}
