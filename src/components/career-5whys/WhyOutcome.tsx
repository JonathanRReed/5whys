import { useClipboard } from '../networking/useClipboard';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { addPhrase, chainPhrases, hasPhrase, outcomeText, removePhrase } from './outcome';
import type { WhyOutcome as Outcome } from './shared';

type Props = {
  answers: string[];
  /** The root reason as the statement above reads it, used when no statement is written. */
  root: string;
  outcome: Outcome;
  /** The chain started from an experience, which is a story waiting to be told. */
  fromExperience: boolean;
  onChange: (field: keyof Outcome, value: string) => void;
};

const LIMIT = 600;

/**
 * The end of the chain: a statement the visitor builds from their own
 * phrases and edits, what a role must offer and what they can give up, and
 * where to take it next. Every word here is one the visitor wrote or picked.
 */
export default function WhyOutcome({ answers, root, outcome, fromExperience, onChange }: Props) {
  const phrases = chainPhrases(answers);
  const statement = outcome.statement ?? '';
  const { copiedKey, copyStatus, handleCopy } = useClipboard();
  const text = outcomeText(outcome, root);
  const copied = copiedKey === 'why-outcome';

  return (
    <section
      aria-labelledby="why-outcome-title"
      className="space-y-5 border-t border-border/40 pt-5"
      data-guide="why-outcome"
    >
      <div className="space-y-1">
        <h3 id="why-outcome-title" className="font-display text-lg font-semibold text-foreground">
          Say it in your own words
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Press the phrases that sound most like you. Each one joins your statement, where you can
          edit it. Press it again to take it out.
        </p>
      </div>

      {phrases.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Phrases from your answers">
          {phrases.map((phrase) => {
            const picked = hasPhrase(statement, phrase.text);
            return (
              <li key={`${phrase.depth}-${phrase.text}`} className="min-w-0">
                <button
                  type="button"
                  aria-pressed={picked}
                  onClick={() =>
                    onChange(
                      'statement',
                      (picked
                        ? removePhrase(statement, phrase.text)
                        : addPhrase(statement, phrase.text)
                      ).slice(0, LIMIT)
                    )
                  }
                  className="max-w-full rounded-lg border border-border/50 px-3 py-1.5 text-left text-sm leading-snug break-words text-foreground transition-colors hover:bg-overlay/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-foam aria-pressed:bg-foam/10"
                >
                  <span className="num-index mr-1.5 text-xs text-muted-foreground">
                    {phrase.depth + 1}
                  </span>
                  {phrase.text}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="grid gap-2">
        <Label htmlFor="why-statement-draft">Your statement</Label>
        <Textarea
          id="why-statement-draft"
          value={statement}
          maxLength={LIMIT}
          onChange={(event) => onChange('statement', event.target.value)}
          placeholder={root || 'Press a phrase above, or write it here.'}
          className="min-h-[88px] border-border/50 bg-overlay/30 text-foreground"
        />
      </div>

      <div className="space-y-1">
        <h3 className="font-display text-lg font-semibold text-foreground">
          What it means for a job
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Two short lists to hold any posting or offer against.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="why-must-offer">A role must offer</Label>
          <Textarea
            id="why-must-offer"
            value={outcome.mustOffer ?? ''}
            maxLength={LIMIT}
            onChange={(event) => onChange('mustOffer', event.target.value)}
            placeholder="For example: time with the people I help, a lead who explains why"
            className="min-h-[72px] border-border/50 bg-overlay/30 text-foreground"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="why-can-give-up">I can give up</Label>
          <Textarea
            id="why-can-give-up"
            value={outcome.canGiveUp ?? ''}
            maxLength={LIMIT}
            onChange={(event) => onChange('canGiveUp', event.target.value)}
            placeholder="For example: a big company name, working close to home"
            className="min-h-[72px] border-border/50 bg-overlay/30 text-foreground"
          />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border/50 p-4" data-guide="why-next">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Use it next</p>
        <ul className="space-y-2 text-sm leading-relaxed">
          <li>
            <a
              href="/networking-practice/"
              className="font-medium text-foreground underline decoration-foam/60 underline-offset-4 hover:decoration-foam"
            >
              Put it in a networking intro
            </a>
            <span className="text-muted-foreground">
              {' '}
              Networking Practice offers your statement beside the draft box.
            </span>
          </li>
          <li>
            <a
              href="/application/"
              className="font-medium text-foreground underline decoration-foam/60 underline-offset-4 hover:decoration-foam"
            >
              Read a posting against your lists
            </a>
            <span className="text-muted-foreground">
              {' '}
              on the Application Desk. Copy them first so they sit beside the posting.
            </span>
          </li>
          <li>
            <a
              href="/interview-glow-up/workspace/"
              className="font-medium text-foreground underline decoration-foam/60 underline-offset-4 hover:decoration-foam"
            >
              {fromExperience
                ? 'Turn this experience into an interview story'
                : 'Use it in an interview answer'}
            </a>
            <span className="text-muted-foreground">
              {' '}
              in the Interview Workspace. Copy it first, then paste it into a story.
            </span>
          </li>
        </ul>
        <Button
          type="button"
          variant="outline"
          disabled={!text}
          onClick={() => handleCopy(text, 'why-outcome')}
          className="border-border/60"
        >
          {copied ? 'Copied' : 'Copy statement and lists'}
        </Button>
        <p role="status" className="sr-only">
          {copyStatus?.key === 'why-outcome'
            ? copyStatus.succeeded
              ? 'Copied your statement and lists.'
              : 'Could not copy. Select the text and copy it yourself.'
            : ''}
        </p>
      </div>
    </section>
  );
}
