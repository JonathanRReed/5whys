/**
 * The provider registry. A task asks it for a provider at the moment the
 * student clicks; it returns the first one that is ready without a download,
 * the browser's model before a hosted one, or null for the rules.
 */
import { createBrowserModelProvider } from './browser-model';
import type {
  HostedModelProvider,
  ModelSource,
  ProviderRegistry,
  TextGenerationProvider,
} from './types';

const SOURCE_ORDER: Record<ModelSource, number> = { 'browser-model': 0, 'hosted-model': 1 };

/** A registry holding exactly the providers given. Tests and previews use their own. */
export function createProviderRegistry(
  initial: readonly TextGenerationProvider[] = []
): ProviderRegistry {
  let providers: TextGenerationProvider[] = [];

  const registry: ProviderRegistry = {
    register(provider) {
      providers = [...providers.filter((p) => p.id !== provider.id), provider];
      return () => registry.unregister(provider.id);
    },
    unregister(id) {
      providers = providers.filter((p) => p.id !== id);
    },
    list() {
      return [...providers].sort((a, b) => SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source]);
    },
    async pick(signal) {
      for (const provider of registry.list()) {
        if (signal?.aborted) return null;
        try {
          if (await provider.isReady()) return provider;
        } catch {
          // A provider that cannot answer is not ready.
        }
      }
      return null;
    },
  };

  for (const provider of initial) registry.register(provider);
  return registry;
}

let shared: ProviderRegistry | null = null;

/**
 * The registry tasks use by default. Created on first use and holding the
 * browser's model; a hosted model joins it through `registerHostedProvider`.
 */
export function getDefaultRegistry(): ProviderRegistry {
  if (!shared) shared = createProviderRegistry([createBrowserModelProvider()]);
  return shared;
}

/**
 * The Tier 2 slot. Another library implements a model this site hosts (for
 * example through WebLLM) and registers it here. Returns the unregister
 * function. The registry never disposes a provider; its owner does.
 */
export function registerHostedProvider(
  provider: HostedModelProvider,
  registry: ProviderRegistry = getDefaultRegistry()
): () => void {
  return registry.register(provider);
}
