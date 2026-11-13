import { describe, expect, it, vi } from 'vitest';
import {
  createProviderRegistry,
  followUpWhy,
  type HostedModelProvider,
  interviewFollowUp,
  messageVariants,
  registerHostedProvider,
  rewriteBullet,
  type TextGenerationProvider,
  translateWording,
} from '../src/lib/local-ai';

function fakeProvider(
  outputs: (string | Error | 'hang')[],
  overrides: Partial<TextGenerationProvider> = {}
): TextGenerationProvider & { calls: { system: string; user: string }[] } {
  const calls: { system: string; user: string }[] = [];
  let index = 0;
  return {
    id: 'fake',
    source: 'hosted-model',
    calls,
    isReady: async () => true,
    generate(prompt, options) {
      calls.push(prompt);
      const output = outputs[Math.min(index, outputs.length - 1)];
      index += 1;
      if (output === 'hang') {
        return new Promise<string>((_, reject) => {
          options.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        });
      }
      if (output instanceof Error) return Promise.reject(output);
      return Promise.resolve(output);
    },
    dispose: vi.fn(),
    ...overrides,
  };
}

const registryWith = (...providers: TextGenerationProvider[]) => createProviderRegistry(providers);

describe('fail closed', () => {
  it('returns the rules on timeout', async () => {
    const registry = registryWith(fakeProvider(['hang']));
    const result = await interviewFollowUp(
      { question: 'Q', answer: 'We built an app.' },
      { registry, timeoutMs: 20 }
    );
    expect(result).toMatchObject({ source: 'rules', fallbackReason: 'timeout' });
    expect(result.value.followUp).toBe('What was your part specifically?');
  });

  it('returns the rules when the caller aborts mid-generation', async () => {
    const registry = registryWith(fakeProvider(['hang']));
    const controller = new AbortController();
    const pending = interviewFollowUp(
      { question: 'Q', answer: 'We built an app.' },
      { registry, signal: controller.signal }
    );
    setTimeout(() => controller.abort(), 5);
    await expect(pending).resolves.toMatchObject({ source: 'rules', fallbackReason: 'aborted' });
  });

  it('returns the rules at once for an already aborted signal', async () => {
    const provider = fakeProvider(['What was hard?']);
    const controller = new AbortController();
    controller.abort();
    const result = await interviewFollowUp(
      { question: 'Q', answer: 'I did it.' },
      { registry: registryWith(provider), signal: controller.signal }
    );
    expect(result.fallbackReason).toBe('aborted');
    expect(provider.calls).toHaveLength(0);
  });

  it('returns the rules when the provider throws', async () => {
    const result = await interviewFollowUp(
      { question: 'Q', answer: 'I did it.' },
      { registry: registryWith(fakeProvider([new Error('boom')])) }
    );
    expect(result).toMatchObject({ source: 'rules', fallbackReason: 'error' });
  });

  it('returns the rules when generate throws synchronously', async () => {
    const provider = fakeProvider([], {
      generate: () => {
        throw new Error('sync boom');
      },
    });
    const result = await interviewFollowUp(
      { question: 'Q', answer: 'I did it.' },
      { registry: registryWith(provider) }
    );
    expect(result).toMatchObject({ source: 'rules', fallbackReason: 'error' });
  });

  it('treats a provider whose readiness check throws as not ready', async () => {
    const provider = fakeProvider(['x'], {
      isReady: async () => {
        throw new Error('nope');
      },
    });
    const result = await interviewFollowUp(
      { question: 'Q', answer: 'I did it.' },
      { registry: registryWith(provider) }
    );
    expect(result.fallbackReason).toBe('no-model');
  });

  it('returns the rules for empty model output', async () => {
    const result = await interviewFollowUp(
      { question: 'Q', answer: 'I did it.' },
      { registry: registryWith(fakeProvider(['   '])) }
    );
    expect(result.fallbackReason).toBe('malformed');
  });

  it('skips every model when asked for rules only', async () => {
    const provider = fakeProvider(['What was hard?']);
    const result = await interviewFollowUp(
      { question: 'Q', answer: 'I did it.' },
      { registry: registryWith(provider), rulesOnly: true }
    );
    expect(result.fallbackReason).toBe('rules-only');
    expect(provider.calls).toHaveLength(0);
  });
});

describe('streaming providers', () => {
  it('joins an async iterable of deltas', async () => {
    const provider = fakeProvider([], {
      generate: () =>
        (async function* () {
          yield 'What was ';
          yield 'your part?';
        })(),
    });
    const result = await interviewFollowUp(
      { question: 'Q', answer: 'We did it.' },
      { registry: registryWith(provider) }
    );
    expect(result).toMatchObject({
      source: 'hosted-model',
      value: { followUp: 'What was your part?' },
    });
  });

  it('cleans em dashes and exclamation marks from model text', async () => {
    const result = await interviewFollowUp(
      { question: 'Q', answer: 'We did it.' },
      { registry: registryWith(fakeProvider(['Great — what was your part!'])) }
    );
    expect(result.value.followUp).toBe('Great, what was your part.');
  });
});

describe('the registry', () => {
  it('prefers the browser model over a hosted one', async () => {
    const hosted = fakeProvider(['From hosted?'], { id: 'hosted', source: 'hosted-model' });
    const browser = fakeProvider(['From browser?'], { id: 'browser', source: 'browser-model' });
    const registry = registryWith(hosted, browser);
    expect((await registry.pick())?.id).toBe('browser');
  });

  it('skips a provider that is not ready', async () => {
    const browser = fakeProvider([], {
      id: 'browser',
      source: 'browser-model',
      isReady: async () => false,
    });
    const hosted = fakeProvider(['x'], { id: 'hosted' });
    expect((await registryWith(browser, hosted).pick())?.id).toBe('hosted');
  });

  it('lets a hosted provider register and unregister (the Tier 2 slot)', async () => {
    const registry = createProviderRegistry();
    const hosted: HostedModelProvider = {
      ...fakeProvider(['What changed for the people you helped?']),
      id: 'webllm',
      source: 'hosted-model',
    };
    const unregister = registerHostedProvider(hosted, registry);
    const result = await interviewFollowUp({ question: 'Q', answer: 'I helped.' }, { registry });
    expect(result.source).toBe('hosted-model');
    unregister();
    expect(registry.list()).toEqual([]);
    const after = await interviewFollowUp({ question: 'Q', answer: 'I helped.' }, { registry });
    expect(after.source).toBe('rules');
  });

  it('replaces a provider registered twice under one id', () => {
    const registry = createProviderRegistry();
    registry.register(fakeProvider([], { id: 'a' }));
    registry.register(fakeProvider([], { id: 'a' }));
    expect(registry.list()).toHaveLength(1);
  });
});

describe('model output per task', () => {
  it('followUpWhy uses the model only after the first answer and checks it against the answers', async () => {
    const provider = fakeProvider(['Why does explaining things to people matter to you?']);
    const result = await followUpWhy(
      {
        track: 'interest',
        topic: 'Biology',
        answers: ['I like explaining how things work to people.', '', '', '', ''],
      },
      { registry: registryWith(provider) }
    );
    expect(result).toMatchObject({
      source: 'hosted-model',
      inventedClaims: [],
      value: { question: 'Why does explaining things to people matter to you?' },
    });
    expect(provider.calls[0].user).toContain('1. I like explaining');
  });

  it('messageVariants flags a weekday the model added, per field', async () => {
    const json = JSON.stringify({
      linkedInMessage: 'Hi Priya, I applied for the Marketing intern role at Northwind.',
      followUpEmail: { subject: 'Marketing intern application', body: 'Can we talk on Friday?' },
      introCallOpener: 'Thank you for making time to talk.',
    });
    const result = await messageVariants(
      {
        opener: 'I ran the campus radio Instagram.',
        role: 'Marketing intern',
        company: 'Northwind',
        contactName: 'Priya',
      },
      { registry: registryWith(fakeProvider([json, json])) }
    );
    expect(result.source).toBe('hosted-model');
    expect(result.inventedClaims).toEqual([
      { kind: 'date', text: 'Friday', start: 15, end: 21, field: 'followUpEmail.body' },
    ]);
  });

  it('translateWording strikes a tool the model added and a posting tool the student never named', async () => {
    const json = JSON.stringify({
      terms: ['social media management', 'Hootsuite'],
      honestUse: 'Use these if you planned the posts.',
    });
    const result = await translateWording(
      { phrase: "I ran the club's Instagram", postingTerms: ['Hootsuite'] },
      { registry: registryWith(fakeProvider([json, json])) }
    );
    expect(result.value.suggestions).toEqual([
      { term: 'social media management', fromPosting: false },
      { term: 'Hootsuite', fromPosting: false },
    ]);
    expect(result.inventedClaims.map((c) => [c.kind, c.text, c.field])).toEqual([
      ['tool', 'Hootsuite', 'suggestions.1.term'],
    ]);
  });

  it('rewriteBullet flags a model that turns helping into leading', async () => {
    const result = await rewriteBullet(
      { line: 'Helped with the rollout of the new sign-in system' },
      { registry: registryWith(fakeProvider(['Led the rollout of the new sign-in system'])) }
    );
    expect(result.inventedClaims.map((c) => [c.kind, c.text])).toEqual([['ownership', 'Led']]);
  });
});
