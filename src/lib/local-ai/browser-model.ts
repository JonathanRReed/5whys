/**
 * Tier 1: the browser's built-in model through Chrome's Prompt API, the
 * global `LanguageModel`.
 *
 * Shape checked against https://developer.chrome.com/docs/ai/prompt-api and
 * https://developer.chrome.com/docs/ai/get-started on 2026-11-12:
 * - `LanguageModel.availability(options)` resolves to 'unavailable',
 *   'downloadable', 'downloading', or 'available'.
 * - `LanguageModel.create(options)` starts a browser-managed download when
 *   the model is not on the device, and needs user activation to do so.
 *   `monitor(m)` receives `downloadprogress` events whose `loaded` is a
 *   fraction from 0 to 1. `signal` aborts creation.
 * - `session.promptStreaming(input, { signal, responseConstraint })` returns
 *   a ReadableStream of text chunks; `session.destroy()` frees it.
 *
 * Nothing here runs at module load. Every global is read inside a function.
 */
import type {
  BrowserModelCapability,
  GenerateOptions,
  ModelPrompt,
  TextGenerationProvider,
} from './types';

type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

type LanguageModelMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type DownloadMonitor = {
  addEventListener(type: 'downloadprogress', listener: (event: { loaded: number }) => void): void;
};

/** Options that decide whether the model can serve us. Shared by availability and create. */
type CapabilityOptions = {
  expectedInputs: { type: 'text'; languages: string[] }[];
  expectedOutputs: { type: 'text'; languages: string[] }[];
};

type CreateOptions = CapabilityOptions & {
  initialPrompts?: LanguageModelMessage[];
  signal?: AbortSignal;
  monitor?: (monitor: DownloadMonitor) => void;
};

type LanguageModelSession = {
  prompt(
    input: string,
    options?: { signal?: AbortSignal; responseConstraint?: unknown }
  ): Promise<string>;
  promptStreaming?(
    input: string,
    options?: { signal?: AbortSignal; responseConstraint?: unknown }
  ): AsyncIterable<string> | ReadableStream<string>;
  destroy(): void;
};

/** The parts of the `LanguageModel` global this layer uses. */
export type LanguageModelApi = {
  availability(options: CapabilityOptions): Promise<Availability>;
  create(options: CreateOptions): Promise<LanguageModelSession>;
};

/**
 * The options passed to both `availability()` and `create()`, so the answer
 * to "is it available" is about the same model we then create.
 */
export const BROWSER_MODEL_OPTIONS: Readonly<CapabilityOptions> = Object.freeze({
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
});

function capabilityOptions(): CapabilityOptions {
  // A fresh copy each call; the API may hold on to what it is given.
  return {
    expectedInputs: BROWSER_MODEL_OPTIONS.expectedInputs.map((entry) => ({
      ...entry,
      languages: [...entry.languages],
    })),
    expectedOutputs: BROWSER_MODEL_OPTIONS.expectedOutputs.map((entry) => ({
      ...entry,
      languages: [...entry.languages],
    })),
  };
}

type ApiLookup = { api: LanguageModelApi } | { api: null; reason: 'insecure-context' | 'no-api' };

function lookupApi(): ApiLookup {
  const scope = globalThis as { isSecureContext?: boolean; LanguageModel?: unknown };
  if (!scope.isSecureContext) return { api: null, reason: 'insecure-context' };
  if (!('LanguageModel' in globalThis) || !scope.LanguageModel)
    return { api: null, reason: 'no-api' };
  return { api: scope.LanguageModel as LanguageModelApi };
}

/**
 * What the browser's model can do right now. Never downloads, never throws.
 * 'downloadable' means a click on an explicit download button can fetch it.
 */
export async function getBrowserModelCapability(): Promise<BrowserModelCapability> {
  const lookup = lookupApi();
  if (!lookup.api) return { state: 'unsupported', reason: lookup.reason };
  try {
    const availability = await lookup.api.availability(capabilityOptions());
    switch (availability) {
      case 'available':
      case 'downloadable':
      case 'downloading':
        return { state: availability };
      default:
        return { state: 'unsupported', reason: 'unavailable' };
    }
  } catch {
    return { state: 'unsupported', reason: 'error' };
  }
}

export type DownloadBrowserModelOptions = {
  /** Called with the fraction downloaded, from 0 to 1. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
};

/**
 * Ask the browser to fetch its model. Call this only from a click on a
 * button that says the browser downloads the model from its maker: creating
 * a session is what starts the download, and the browser requires a user
 * gesture for it. The session made for the download is destroyed at once.
 *
 * Resolves to the capability afterwards. Never throws; a failure resolves to
 * whatever state the browser reports next.
 */
export async function downloadBrowserModel(
  options: DownloadBrowserModelOptions = {}
): Promise<BrowserModelCapability> {
  const before = await getBrowserModelCapability();
  if (before.state === 'unsupported' || before.state === 'available') return before;
  const lookup = lookupApi();
  if (!lookup.api) return before;
  let session: LanguageModelSession | null = null;
  try {
    session = await lookup.api.create({
      ...capabilityOptions(),
      signal: options.signal,
      monitor(monitor) {
        monitor.addEventListener('downloadprogress', (event) => {
          const loaded = Number(event?.loaded);
          if (!Number.isFinite(loaded)) return;
          try {
            options.onProgress?.(Math.min(1, Math.max(0, loaded)));
          } catch {
            // A broken progress callback must not cancel the download.
          }
        });
      },
    });
  } catch {
    // Aborted, refused without a user gesture, or failed. Report the state.
  } finally {
    destroyQuietly(session);
  }
  return getBrowserModelCapability();
}

function destroyQuietly(session: LanguageModelSession | null): void {
  if (!session) return;
  try {
    session.destroy();
  } catch {
    // Already destroyed.
  }
}

async function* iterateStream(
  stream: AsyncIterable<string> | ReadableStream<string>
): AsyncIterable<string> {
  if (Symbol.asyncIterator in stream) {
    yield* stream as AsyncIterable<string>;
    return;
  }
  const reader = (stream as ReadableStream<string>).getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Join streamed chunks. Current Chrome sends deltas; early versions sent the
 * whole text so far. A chunk that repeats everything already received is
 * treated as the whole text.
 */
export function appendChunk(accumulated: string, chunk: string): string {
  if (accumulated && chunk.startsWith(accumulated)) return chunk;
  return accumulated + chunk;
}

export const BROWSER_PROVIDER_ID = 'browser-model';

/**
 * The provider the default registry holds. It is ready only when the model
 * is already on the device, and `generate` checks again before creating a
 * session, so a task run from a click can never start a download.
 */
export function createBrowserModelProvider(): TextGenerationProvider {
  const live = new Set<LanguageModelSession>();
  return {
    id: BROWSER_PROVIDER_ID,
    source: 'browser-model',
    async isReady() {
      return (await getBrowserModelCapability()).state === 'available';
    },
    async generate(prompt: ModelPrompt, options: GenerateOptions): Promise<string> {
      const lookup = lookupApi();
      if (!lookup.api) throw new Error('The browser has no built-in model.');
      const availability = await lookup.api.availability(capabilityOptions());
      if (availability !== 'available') throw new Error('The browser model is not on this device.');
      const session = await lookup.api.create({
        ...capabilityOptions(),
        initialPrompts: [{ role: 'system', content: prompt.system }],
        signal: options.signal,
      });
      live.add(session);
      try {
        const promptOptions = {
          signal: options.signal,
          ...(options.responseSchema ? { responseConstraint: options.responseSchema } : {}),
        };
        if (typeof session.promptStreaming !== 'function') {
          return await session.prompt(prompt.user, promptOptions);
        }
        let text = '';
        for await (const chunk of iterateStream(
          session.promptStreaming(prompt.user, promptOptions)
        )) {
          if (options.signal?.aborted) throw new Error('Aborted.');
          text = appendChunk(text, String(chunk));
        }
        return text;
      } finally {
        live.delete(session);
        destroyQuietly(session);
      }
    },
    dispose() {
      for (const session of live) destroyQuietly(session);
      live.clear();
    },
  };
}
