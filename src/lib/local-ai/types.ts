/**
 * Shared types for the local AI layer. Nothing here touches the DOM.
 *
 * Three tiers produce text: rules (always present), the browser's own model,
 * and a model this site hosts. Every result says which one wrote it.
 */

/** Which tier produced a result. The interface labels generated text with it. */
export type AiSource = 'rules' | 'browser-model' | 'hosted-model';

/** A tier that runs a model, as opposed to the rules. */
export type ModelSource = Exclude<AiSource, 'rules'>;

/**
 * Why a task answered from the rules instead of a model. Absent when a model
 * produced the result.
 */
export type FallbackReason =
  /** No registered provider was ready (no API, model not downloaded, unsupported). */
  | 'no-model'
  /** The caller asked for rules only. */
  | 'rules-only'
  /** The task has nothing for a model to do (for example, all five whys are answered). */
  | 'not-needed'
  /** The caller's AbortSignal fired. */
  | 'aborted'
  /** The model did not answer in time. */
  | 'timeout'
  /** The model answered with something the task could not use, twice. */
  | 'malformed'
  /** The provider threw. */
  | 'error';

/** The kinds of claim a generated text can add that the student never wrote. */
export type ClaimKind =
  | 'number'
  | 'percentage'
  | 'currency'
  | 'date'
  | 'proper-noun'
  | 'tool'
  /** A verb of ownership ("led", "managed") the student did not use. */
  | 'ownership';

/**
 * A fact in generated text that does not appear in the inputs. `start` and
 * `end` are character offsets into the field named by `field`, so the
 * interface can strike exactly that span. They locate text; they rate nothing.
 */
export type InventedClaim = {
  kind: ClaimKind;
  text: string;
  start: number;
  end: number;
  /** Which output field the claim sits in, for example `questions.2.question`. */
  field?: string;
};

/**
 * What every task returns. `inventedClaims` is empty for clean output; when
 * it is not, the interface must strike or flag each claim before the student
 * can accept the text.
 */
export type AiResult<T> = {
  value: T;
  source: AiSource;
  inventedClaims: InventedClaim[];
  fallbackReason?: FallbackReason;
};

/** A prompt as two short parts: standing instructions and the task input. */
export type ModelPrompt = {
  system: string;
  user: string;
};

export type GenerateOptions = {
  signal?: AbortSignal;
  /**
   * A JSON Schema the output must follow. Providers that support constrained
   * output pass it on; others may ignore it, so parsers stay tolerant.
   */
  responseSchema?: Record<string, unknown>;
};

/**
 * The one interface every model tier implements. Tier 2 (a model this site
 * hosts, such as one run through WebLLM) is registered by another library
 * against this same shape.
 */
export interface TextGenerationProvider {
  /** Stable identifier, used to unregister. */
  readonly id: string;
  readonly source: ModelSource;
  /**
   * True only when `generate` can start right now without downloading
   * anything. Must never trigger a download and must not throw.
   */
  isReady(): Promise<boolean>;
  /**
   * Produce text for a prompt. May stream (an async iterable of text deltas)
   * or resolve once. May throw; the layer catches everything.
   */
  generate(prompt: ModelPrompt, options: GenerateOptions): AsyncIterable<string> | Promise<string>;
  /** Release anything the provider holds. Safe to call more than once. */
  dispose(): void | Promise<void>;
}

/** A provider for a model this site hosts. Implemented elsewhere, registered here. */
export interface HostedModelProvider extends TextGenerationProvider {
  readonly source: 'hosted-model';
}

export interface ProviderRegistry {
  /** Add a provider. Returns a function that removes it again. */
  register(provider: TextGenerationProvider): () => void;
  unregister(id: string): void;
  list(): readonly TextGenerationProvider[];
  /**
   * The first ready provider at call time, browser model before hosted
   * model, or null. Never throws and never starts a download.
   */
  pick(signal?: AbortSignal): Promise<TextGenerationProvider | null>;
}

/** Options every task accepts. */
export type TaskOptions = {
  signal?: AbortSignal;
  /** Milliseconds to wait for each model attempt before using the rules. */
  timeoutMs?: number;
  /** Defaults to the shared registry, which holds the browser model. */
  registry?: ProviderRegistry;
  /** Skip every model and answer from the rules. */
  rulesOnly?: boolean;
};

/** States of the browser's built-in model, as the interface should present them. */
export type BrowserModelState = 'unsupported' | 'downloadable' | 'downloading' | 'available';

export type BrowserModelCapability = {
  state: BrowserModelState;
  /** Why the model is unsupported, when it is. */
  reason?: 'insecure-context' | 'no-api' | 'unavailable' | 'error';
};
