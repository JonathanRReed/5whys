import { useSyncExternalStore } from 'react';

export const MISSING_FEATURE_MESSAGE =
  'This part has not been downloaded on this device yet. Connect to the internet and try it once, then it will be available offline.';
export const FAILED_FEATURE_MESSAGE =
  'This part could not load. Connect to the internet and try again.';

let message: string | null = null;
const listeners = new Set<() => void>();

/** At the import boundary, keep the cause and give both caught and uncaught paths a notice. */
export async function loadFeature<T>(module: Promise<T>): Promise<T> {
  try {
    return await module;
  } catch (cause) {
    reportFeatureFailure(cause);
    throw new Error(message ?? FAILED_FEATURE_MESSAGE, { cause });
  }
}

export function reportFeatureFailure(_cause: unknown): void {
  message =
    typeof navigator !== 'undefined' && !navigator.onLine
      ? MISSING_FEATURE_MESSAGE
      : FAILED_FEATURE_MESSAGE;
  for (const listener of listeners) listener();
}

/** Catch event-handler failures without leaving a button busy or rejecting into React. */
export async function runFeature(
  action: () => Promise<unknown>,
  settled?: () => void
): Promise<void> {
  try {
    await action();
  } catch (cause) {
    reportFeatureFailure(cause);
  } finally {
    settled?.();
  }
}

export function dismissFeatureFailure(): void {
  message = null;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useFeatureFailure(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => message,
    () => null
  );
}
