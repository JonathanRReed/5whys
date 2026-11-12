import * as React from 'react';
import type { AiResult, RewriteBulletOutput } from '../../lib/local-ai';
import { AiText, sourceLabel } from '../shared/AiText';
import { Button } from '../ui/button';

type Props = {
  /** The line as it currently reads. */
  line: string;
};

/**
 * One suggested rewrite of a bullet, asked for with a click. The suggestion
 * is shown beside the visitor's own line and is never applied for them: the
 * score only moves when they change a field themselves.
 */
export default function RewriteHelp({ line }: Props) {
  const [result, setResult] = React.useState<AiResult<RewriteBulletOutput> | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const request = React.useRef<AbortController | null>(null);

  // A suggestion belongs to the line it was written for.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when the line changes
  React.useEffect(() => {
    request.current?.abort();
    setResult(null);
    setBusy(false);
    setCopied(false);
  }, [line]);

  React.useEffect(() => () => request.current?.abort(), []);

  const suggest = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setCopied(false);
    const { rewriteBullet } = await import('../../lib/local-ai');
    const next = await rewriteBullet({ line }, { signal: controller.signal });
    if (controller.signal.aborted) return;
    setResult(next);
    setBusy(false);
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.value.rewrite);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const invented = result?.inventedClaims ?? [];

  return (
    <div className="space-y-3 rounded-2xl border border-border/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Want a second wording? It uses only what you wrote and runs on this device.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={suggest} disabled={busy}>
          {busy ? 'Writing' : result ? 'Suggest another' : 'Suggest a rewrite'}
        </Button>
      </div>

      <div aria-live="polite">
        {result &&
          (result.value.changed ? (
            <div className="space-y-2">
              <p className="text-sm leading-relaxed text-foreground" data-testid="rewrite-text">
                <AiText text={result.value.rewrite} claims={invented} />
              </p>
              {invented.length > 0 && (
                <p className="text-xs text-love">
                  Struck words were not in your line. Keep them only if they are true.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" size="xs" variant="ghost" onClick={copy}>
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                <span className="text-xs text-muted-foreground">{sourceLabel(result.source)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No safer wording found without adding facts. The fields below are the way to
              strengthen this line.
            </p>
          ))}
      </div>
    </div>
  );
}
