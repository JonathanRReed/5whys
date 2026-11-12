import type { AiResult, InventedClaim } from '../../lib/local-ai';

/** Where a suggestion came from, in the visitor's words. */
export function sourceLabel(source: AiResult<unknown>['source']): string {
  if (source === 'browser-model') return "Written on this device by your browser's model";
  if (source === 'hosted-model') return 'Written on this device';
  return 'From the built-in rules';
}

type Props = {
  text: string;
  /** Claims the visitor never wrote. Each is struck so it cannot be missed. */
  claims: InventedClaim[];
};

/**
 * Generated text with anything the visitor did not write struck through.
 * A model may only rearrange what it was given; an added number, name, or
 * tool is shown, flagged, and left for the visitor to remove.
 */
export function AiText({ text, claims }: Props) {
  const spans = [...claims]
    .filter((claim) => claim.start >= 0 && claim.end <= text.length && claim.end > claim.start)
    .sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const claim of spans) {
    if (claim.start < cursor) continue;
    if (claim.start > cursor) parts.push(text.slice(cursor, claim.start));
    parts.push(
      <del
        key={`${claim.start}-${claim.end}`}
        className="rounded-sm bg-love/15 px-0.5 text-love decoration-love"
        title="Not in what you wrote"
      >
        {text.slice(claim.start, claim.end)}
      </del>
    );
    cursor = claim.end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}
