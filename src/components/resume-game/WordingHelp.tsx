import * as React from 'react';
import { loadFeature, runFeature } from '../../lib/lazy-feature';
import type { AiResult, TranslateWordingOutput } from '../../lib/local-ai';
import { sourceLabel } from '../shared/AiText';
import { Button } from '../ui/button';

/** What the posting match hands to the line editor once the visitor asks. */
export type WordingHint = {
  /** The resume line, as the posting match read it. */
  line: string;
  /** The words to consider, the posting's own first. */
  terms: string[];
  /** When those words are honest to use. */
  honestUse: string | null;
};

type Props = {
  /** One resume line that may be the same work as a requirement. */
  line: string;
  /** The requirement's own words for that work. */
  postingTerms: string[];
  /** Open the line in the editor with these words beside it. */
  onRewrite?: (hint: WordingHint) => void;
};

/**
 * "Same work, wrong words": other words for one of the visitor's lines, the
 * posting's first, each with the condition for using it honestly. The words
 * come from an authored dictionary, or from a model that is already on this
 * device; nothing downloads, and no word goes into the resume until the
 * visitor writes it in the editor.
 */
export default function WordingHelp({ line, postingTerms, onRewrite }: Props) {
  const [result, setResult] = React.useState<AiResult<TranslateWordingOutput> | null>(null);
  const [busy, setBusy] = React.useState(false);
  const request = React.useRef<AbortController | null>(null);

  React.useEffect(() => () => request.current?.abort(), []);

  const find = async () => {
    if (busy) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    const { translateWording } = await loadFeature(import('../../lib/local-ai'));
    const next = await translateWording(
      { phrase: line.replace(/^[-•*]\s*/, ''), postingTerms },
      { signal: controller.signal }
    );
    if (controller.signal.aborted) return;
    setResult(next);
    setBusy(false);
  };

  // A term the guard flags as never written by the visitor or the posting is
  // not offered at all.
  const flagged = new Set(
    (result?.inventedClaims ?? [])
      .map((claim) => claim.field?.match(/^suggestions\.(\d+)\./)?.[1])
      .filter(Boolean)
      .map(Number)
  );
  const terms = (result?.value.suggestions ?? []).filter((_, index) => !flagged.has(index));

  return (
    <div className="space-y-2" data-testid="wording-help">
      <Button
        type="button"
        size="xs"
        variant="outline"
        onClick={() => void runFeature(find, () => setBusy(false))}
        aria-disabled={busy || undefined}
      >
        {busy ? 'Looking' : result ? 'Look again' : 'Show other words for this work'}
      </Button>
      <div aria-live="polite" className="space-y-2">
        {result &&
          (terms.length === 0 ? (
            <p className="text-muted-foreground">
              No other words found for this line. Say it in the posting's words only where they are
              true of what you did.
            </p>
          ) : (
            <>
              <ul className="flex flex-wrap gap-1.5" aria-label="Other words for this work">
                {terms.map((suggestion) => (
                  <li
                    key={suggestion.term}
                    className="rounded-full border border-border/50 px-2.5 py-0.5 text-xs text-foreground"
                  >
                    {suggestion.term}
                    {suggestion.fromPosting && (
                      <span className="ml-1 text-muted-foreground">(the posting's)</span>
                    )}
                  </li>
                ))}
              </ul>
              {result.value.honestUse && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {result.value.honestUse}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                {onRewrite && (
                  <Button
                    type="button"
                    size="xs"
                    onClick={() =>
                      onRewrite({
                        line,
                        terms: terms.map((suggestion) => suggestion.term),
                        honestUse: result.value.honestUse,
                      })
                    }
                  >
                    Rewrite this line with them
                  </Button>
                )}
                <span className="text-xs text-muted-foreground">{sourceLabel(result.source)}</span>
              </div>
            </>
          ))}
      </div>
    </div>
  );
}
