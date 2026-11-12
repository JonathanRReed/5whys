import * as React from 'react';
import type { AiResult, FollowUpWhyInput, FollowUpWhyOutput } from '../../lib/local-ai';
import { sourceLabel } from '../shared/AiText';
import { Button } from '../ui/button';

type Props = FollowUpWhyInput;

/**
 * A follow-up question written from the answers so far, by the browser's own
 * model. It is offered only when that model is ready, because the standard
 * prompt above already comes from the rules. The question is a prompt to think
 * with; it never fills in an answer.
 */
export default function SharperWhy({ track, topic, answers }: Props) {
  const [result, setResult] = React.useState<AiResult<FollowUpWhyOutput> | null>(null);
  const [busy, setBusy] = React.useState(false);
  const request = React.useRef<AbortController | null>(null);
  const answered = answers.join('\u0001');

  // A question belongs to the answers it was written from.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when the answers change
  React.useEffect(() => {
    request.current?.abort();
    setResult(null);
    setBusy(false);
  }, [answered, track, topic]);

  React.useEffect(() => () => request.current?.abort(), []);

  const ask = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    const { followUpWhy } = await import('../../lib/local-ai');
    const next = await followUpWhy({ track, topic, answers }, { signal: controller.signal });
    if (controller.signal.aborted) return;
    setResult(next);
    setBusy(false);
  };

  const question = result?.source === 'browser-model' ? result.value.question : null;

  return (
    <div className="space-y-2">
      <Button type="button" size="sm" variant="outline" onClick={ask} disabled={busy}>
        {busy ? 'Thinking' : result ? 'Ask another' : 'Ask me a sharper why'}
      </Button>
      <div aria-live="polite">
        {question && (
          <p className="text-sm leading-relaxed text-foreground">
            {question}
            <span className="mt-1 block text-xs text-muted-foreground">
              {sourceLabel('browser-model')}
            </span>
          </p>
        )}
        {result && !question && (
          <p className="text-xs text-muted-foreground">
            No sharper question this time. The prompt above still applies.
          </p>
        )}
      </div>
    </div>
  );
}
