/**
 * Runs one task across the tiers and fails closed. Whatever happens (no
 * model, a timeout, an abort, an exception, unusable output) the caller gets
 * the rules result and nothing is thrown.
 *
 * A model answer with invented claims is retried once with a stricter
 * prompt. If the retry still invents, it is returned with the claims listed
 * so the interface can strike them.
 */
import { cleanModelText, findInventedClaims, looksLikeRating } from './guards';
import type { PromptRetry } from './prompts';
import { getDefaultRegistry } from './registry';
import type {
  AiResult,
  ClaimKind,
  FallbackReason,
  InventedClaim,
  ModelPrompt,
  TaskOptions,
} from './types';

/** How long one model attempt may take before the rules answer instead. */
export const DEFAULT_TIMEOUT_MS = 20_000;

export type ClaimField = { field: string; text: string };

export type TaskSpec<T> = {
  /** The Tier 0 answer. Pure and synchronous. */
  rules: () => T;
  /** Everything the student or the posting supplied, for the claim check. */
  sources: readonly string[];
  /** The fields of a value that make claims, with their paths. */
  claimFields: (value: T) => ClaimField[];
  claimKinds?: readonly ClaimKind[];
  prompt: (retry?: PromptRetry) => ModelPrompt;
  responseSchema?: Record<string, unknown>;
  /** Turn cleaned model text into a value, or null if it is unusable. */
  parse: (text: string) => T | null;
  /** True when the rules answer is complete and a model has nothing to add. */
  rulesSuffice?: boolean;
};

class DeadlineError extends Error {
  constructor(readonly reason: 'timeout' | 'aborted') {
    super(reason);
  }
}

export function checkClaims<T>(spec: TaskSpec<T>, value: T): InventedClaim[] {
  return spec.claimFields(value).flatMap(({ field, text }) =>
    findInventedClaims(spec.sources, text, { kinds: spec.claimKinds }).map((claim) => ({
      ...claim,
      field,
    }))
  );
}

/**
 * Run `work` with a child AbortSignal that fires on the caller's abort or on
 * the deadline, and reject with a DeadlineError when either happens first.
 */
async function withDeadline<R>(
  work: (signal: AbortSignal) => Promise<R>,
  timeoutMs: number,
  parent?: AbortSignal
): Promise<R> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onParentAbort: (() => void) | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new DeadlineError('timeout'));
    }, timeoutMs);
    onParentAbort = () => {
      controller.abort();
      reject(new DeadlineError('aborted'));
    };
    if (parent?.aborted) onParentAbort();
    else parent?.addEventListener('abort', onParentAbort, { once: true });
  });
  try {
    return await Promise.race([work(controller.signal), deadline]);
  } finally {
    clearTimeout(timer);
    if (onParentAbort) parent?.removeEventListener('abort', onParentAbort);
    // Stop anything the provider left running once we stop listening.
    controller.abort();
  }
}

async function collect(output: AsyncIterable<string> | Promise<string>): Promise<string> {
  if (output && typeof output === 'object' && Symbol.asyncIterator in output) {
    let text = '';
    for await (const chunk of output as AsyncIterable<string>) text += String(chunk);
    return text;
  }
  return String(await output);
}

export async function runTask<T>(
  spec: TaskSpec<T>,
  options: TaskOptions = {}
): Promise<AiResult<T>> {
  const fallback = (reason: FallbackReason): AiResult<T> => {
    const value = spec.rules();
    return {
      value,
      source: 'rules',
      inventedClaims: checkClaims(spec, value),
      fallbackReason: reason,
    };
  };

  if (options.rulesOnly) return fallback('rules-only');
  if (spec.rulesSuffice) return fallback('not-needed');
  if (options.signal?.aborted) return fallback('aborted');

  const timeoutMs =
    typeof options.timeoutMs === 'number' && options.timeoutMs > 0
      ? options.timeoutMs
      : DEFAULT_TIMEOUT_MS;

  try {
    const registry = options.registry ?? getDefaultRegistry();
    const provider = await withDeadline(
      (signal) => registry.pick(signal),
      timeoutMs,
      options.signal
    );
    if (!provider) return fallback('no-model');

    let retry: PromptRetry | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const prompt = spec.prompt(retry);
      const raw = await withDeadline(
        (signal) =>
          collect(provider.generate(prompt, { signal, responseSchema: spec.responseSchema })),
        timeoutMs,
        options.signal
      );
      const cleaned = cleanModelText(raw);
      const value = cleaned && !looksLikeRating(cleaned) ? safeParse(spec, cleaned) : null;
      if (value === null) {
        retry = { claims: [] };
        continue;
      }
      const claims = checkClaims(spec, value);
      if (claims.length === 0 || attempt === 1) {
        return { value, source: provider.source, inventedClaims: claims };
      }
      retry = { claims: [...new Set(claims.map((claim) => claim.text))] };
    }
    return fallback('malformed');
  } catch (error) {
    if (options.signal?.aborted) return fallback('aborted');
    if (error instanceof DeadlineError) return fallback(error.reason);
    return fallback('error');
  }
}

function safeParse<T>(spec: TaskSpec<T>, text: string): T | null {
  try {
    return spec.parse(text);
  } catch {
    return null;
  }
}

/** The first JSON object in model text, tolerating code fences and preambles. */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
