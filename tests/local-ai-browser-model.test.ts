import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BROWSER_MODEL_OPTIONS,
  downloadBrowserModel,
  getBrowserModelCapability,
  likelyQuestions,
  rewriteBullet,
} from '../src/lib/local-ai';
import { appendChunk } from '../src/lib/local-ai/browser-model';

type Step = string | Error;
type FakeSession = {
  prompt: () => Promise<string>;
  promptStreaming?: (user: string, options: unknown) => AsyncIterable<string>;
  destroy: () => void;
};
type CapabilityOptions = { expectedInputs: unknown; expectedOutputs: unknown };
type CreateOptions = {
  expectedInputs: unknown;
  expectedOutputs: unknown;
  initialPrompts?: { role: string; content: string }[];
  signal?: AbortSignal;
  monitor?: (m: {
    addEventListener(type: string, listener: (e: { loaded: number }) => void): void;
  }) => void;
};

/**
 * A stand-in for Chrome's `LanguageModel` global. Each `create` takes the
 * next script of streamed chunks; an Error in a script is thrown mid-stream.
 */
function installFakeModel({
  availability = 'available' as string | (() => string),
  scripts = [] as Step[][],
  progress = [] as number[],
} = {}) {
  const prompts: { system?: string; user: string; options: unknown }[] = [];
  const destroy = vi.fn();
  let created = 0;
  const api = {
    availability: vi.fn(async (_options: CapabilityOptions) =>
      typeof availability === 'function' ? availability() : availability
    ),
    create: vi.fn(async (options: CreateOptions): Promise<FakeSession> => {
      options.monitor?.({
        addEventListener(_type, listener) {
          for (const loaded of progress) listener({ loaded });
        },
      });
      const script = scripts[created] ?? [''];
      created += 1;
      const system = options.initialPrompts?.find((p) => p.role === 'system')?.content;
      return {
        prompt: vi.fn(async () =>
          script.filter((s): s is string => typeof s === 'string').join('')
        ),
        promptStreaming: (user: string, promptOptions: unknown) => {
          prompts.push({ system, user, options: promptOptions });
          return (async function* () {
            for (const step of script) {
              if (step instanceof Error) throw step;
              yield step;
            }
          })();
        },
        destroy,
      };
    }),
  };
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('LanguageModel', api);
  return { api, prompts, destroy };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('capability report', () => {
  it('is unsupported with no LanguageModel global', async () => {
    vi.stubGlobal('isSecureContext', true);
    expect(await getBrowserModelCapability()).toEqual({ state: 'unsupported', reason: 'no-api' });
  });

  it('is unsupported outside a secure context', async () => {
    const { api } = installFakeModel();
    vi.stubGlobal('isSecureContext', false);
    expect(await getBrowserModelCapability()).toEqual({
      state: 'unsupported',
      reason: 'insecure-context',
    });
    expect(api.availability).not.toHaveBeenCalled();
  });

  it.each(['downloadable', 'downloading', 'available'] as const)('reports %s', async (state) => {
    installFakeModel({ availability: state });
    expect(await getBrowserModelCapability()).toEqual({ state });
  });

  it('maps unavailable to unsupported', async () => {
    installFakeModel({ availability: 'unavailable' });
    expect(await getBrowserModelCapability()).toEqual({
      state: 'unsupported',
      reason: 'unavailable',
    });
  });

  it('is unsupported when availability throws', async () => {
    installFakeModel({
      availability: () => {
        throw new Error('boom');
      },
    });
    expect(await getBrowserModelCapability()).toEqual({ state: 'unsupported', reason: 'error' });
  });

  it('asks about the same options it creates with', async () => {
    const { api } = installFakeModel({ scripts: [['Organized the fair']] });
    await rewriteBullet({ line: 'Organized the fair' });
    const asked = api.availability.mock.calls[0][0];
    const created = api.create.mock.calls[0][0];
    expect(asked).toEqual({ ...BROWSER_MODEL_OPTIONS });
    expect(created.expectedInputs).toEqual(asked.expectedInputs);
    expect(created.expectedOutputs).toEqual(asked.expectedOutputs);
  });
});

describe('tasks with no usable browser model', () => {
  it('answer from the rules when the API is missing', async () => {
    vi.stubGlobal('isSecureContext', true);
    const result = await rewriteBullet({ line: 'Responsible for managing the club Instagram' });
    expect(result.source).toBe('rules');
    expect(result.fallbackReason).toBe('no-model');
    expect(result.value.rewrite).toBe('Managed the club Instagram');
  });

  it.each(['downloadable', 'downloading'] as const)(
    'never create a session (which would download) when %s',
    async (availability) => {
      const { api } = installFakeModel({ availability });
      const result = await rewriteBullet({ line: 'Organized the fair' });
      expect(result.source).toBe('rules');
      expect(api.create).not.toHaveBeenCalled();
    }
  );
});

describe('downloadBrowserModel', () => {
  it('creates a session with a monitor, reports progress, and destroys it', async () => {
    let state = 'downloadable';
    const { api, destroy } = installFakeModel({
      availability: () => state,
      progress: [0, 0.5, 1, 1.4, Number.NaN],
    });
    api.create.mockImplementationOnce(async (options: CreateOptions) => {
      options.monitor?.({
        addEventListener(_type, listener) {
          for (const loaded of [0, 0.5, 1, 1.4, Number.NaN]) listener({ loaded });
        },
      });
      state = 'available';
      return { prompt: vi.fn(async () => ''), destroy };
    });
    const onProgress = vi.fn();
    const result = await downloadBrowserModel({ onProgress });
    expect(result).toEqual({ state: 'available' });
    expect(onProgress.mock.calls.map((c) => c[0])).toEqual([0, 0.5, 1, 1]);
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.create.mock.calls[0][0].expectedInputs).toEqual(
      BROWSER_MODEL_OPTIONS.expectedInputs
    );
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the model is already available', async () => {
    const { api } = installFakeModel({ availability: 'available' });
    expect(await downloadBrowserModel()).toEqual({ state: 'available' });
    expect(api.create).not.toHaveBeenCalled();
  });

  it('does nothing when unsupported', async () => {
    vi.stubGlobal('isSecureContext', true);
    expect((await downloadBrowserModel()).state).toBe('unsupported');
  });

  it('never throws when creation fails, and reports the state after', async () => {
    const { api } = installFakeModel({ availability: 'downloadable' });
    api.create.mockRejectedValueOnce(new Error('NotAllowedError: needs a user gesture'));
    expect(await downloadBrowserModel()).toEqual({ state: 'downloadable' });
  });

  it('survives a progress callback that throws', async () => {
    installFakeModel({ availability: 'downloadable', progress: [0.2] });
    const onProgress = vi.fn(() => {
      throw new Error('ui broke');
    });
    await expect(downloadBrowserModel({ onProgress })).resolves.toEqual({ state: 'downloadable' });
    expect(onProgress).toHaveBeenCalledWith(0.2);
  });
});

describe('tasks with the browser model available', () => {
  it('returns the model rewrite labeled as the browser model, and destroys the session', async () => {
    const { destroy, prompts } = installFakeModel({
      scripts: [['Planned and ', 'posted content for ', 'the club Instagram']],
    });
    const result = await rewriteBullet({
      line: 'Responsible for the club Instagram, planning posts',
    });
    expect(result).toMatchObject({
      source: 'browser-model',
      inventedClaims: [],
      value: { rewrite: 'Planned and posted content for the club Instagram', changed: true },
    });
    expect(result.fallbackReason).toBeUndefined();
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(prompts[0].system).toContain('Use only facts that are in the input.');
    expect(prompts[0].user).toContain('Responsible for the club Instagram');
  });

  it('falls back to the rules when the stream throws mid-way, and still destroys', async () => {
    const { destroy } = installFakeModel({
      scripts: [
        ['Planned posts ', new Error('model crashed')],
        ['Planned posts ', new Error('again')],
      ],
    });
    const result = await rewriteBullet({ line: 'Responsible for managing the club Instagram' });
    expect(result.source).toBe('rules');
    expect(result.fallbackReason).toBe('error');
    expect(result.value.rewrite).toBe('Managed the club Instagram');
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('retries with a stricter prompt when the model invents a number, and keeps the clean retry', async () => {
    const { prompts, destroy } = installFakeModel({
      scripts: [
        ['Grew the club Instagram by 40% with weekly posts'],
        ['Grew the club Instagram with weekly posts'],
      ],
    });
    const result = await rewriteBullet({ line: 'Did the club Instagram, posted weekly, it grew' });
    expect(result.source).toBe('browser-model');
    expect(result.inventedClaims).toEqual([]);
    expect(result.value.rewrite).toBe('Grew the club Instagram with weekly posts');
    expect(prompts).toHaveLength(2);
    expect(prompts[1].system).toContain('It added things that are not in the input: 40%.');
    expect(destroy).toHaveBeenCalledTimes(2);
  });

  it('returns the claims for the interface to strike when the retry still invents', async () => {
    installFakeModel({
      scripts: [['Posted 3 times a week for the club'], ['Posted 3 times a week for the club']],
    });
    const result = await rewriteBullet({ line: 'Posted for the club' });
    expect(result.source).toBe('browser-model');
    expect(result.inventedClaims).toEqual([
      { kind: 'number', text: '3', start: 7, end: 8, field: 'rewrite' },
    ]);
  });

  it('passes the JSON schema as a response constraint for list tasks', async () => {
    const { prompts } = installFakeModel({
      scripts: [
        [
          '{"questions":[{"question":"Tell me about a SQL query you wrote.","requirement":"Experience with SQL"}]}',
        ],
      ],
    });
    const result = await likelyQuestions({ requirements: ['Experience with SQL'] });
    expect(result.source).toBe('browser-model');
    expect(result.value.questions).toEqual([
      { question: 'Tell me about a SQL query you wrote.', requirement: 'Experience with SQL' },
    ]);
    expect(prompts[0].options).toMatchObject({ responseConstraint: { type: 'object' } });
  });

  it('falls back to the rules on malformed JSON twice', async () => {
    installFakeModel({ scripts: [['not json at all'], ['{"questions": "nope"}']] });
    const result = await likelyQuestions({ requirements: ['Experience with SQL'] });
    expect(result.source).toBe('rules');
    expect(result.fallbackReason).toBe('malformed');
  });

  it('rejects a model answer that rates the student', async () => {
    installFakeModel({ scripts: [['I would rate this line 6/10'], ['Still a 6 out of 10']] });
    const result = await rewriteBullet({ line: 'Organized the fair' });
    expect(result.source).toBe('rules');
    expect(result.fallbackReason).toBe('malformed');
  });

  it('accepts cumulative chunks from older streaming behavior', () => {
    expect(appendChunk('', 'Plan')).toBe('Plan');
    expect(appendChunk('Plan', 'ned')).toBe('Planned');
    expect(appendChunk('Plan', 'Planned the fair')).toBe('Planned the fair');
  });
});
