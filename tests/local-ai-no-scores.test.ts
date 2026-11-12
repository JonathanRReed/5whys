import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import * as localAi from '../src/lib/local-ai';

/**
 * The layer must never hand the interface a number that rates the student.
 * This reads the public API's types with the TypeScript compiler, walks every
 * exported function's (awaited) return type, and reports every number it
 * finds. The only numbers allowed are the character offsets of an invented
 * claim, which locate text and rate nothing.
 */
const ALLOWED_NUMBER_PATHS = new Set(['inventedClaims[].start', 'inventedClaims[].end']);
const ALLOWED_RETURN_NUMBERS: Record<string, Set<string>> = {
  findInventedClaims: new Set(['[].start', '[].end']),
};
const RATING_NAME = /score|rating|grade|percent|confidence|probability|rank|level/i;
const TASKS = [
  'rewriteBullet',
  'followUpWhy',
  'likelyQuestions',
  'messageVariants',
  'translateWording',
  'interviewFollowUp',
];

const root = path.resolve(import.meta.dirname, '..');
const entry = path.join(root, 'src/lib/local-ai/index.ts');

function loadApi() {
  const program = ts.createProgram([entry], {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    types: [],
  });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(entry);
  if (!source) throw new Error('index.ts not found');
  const moduleSymbol = checker.getSymbolAtLocation(source);
  if (!moduleSymbol) throw new Error('no module symbol');
  return { checker, exports: checker.getExportsOfModule(moduleSymbol) };
}

type Finding = { path: string; kind: 'number' | 'name' };

function walk(
  checker: ts.TypeChecker,
  type: ts.Type,
  at: string,
  seen: Set<ts.Type>,
  out: Finding[]
) {
  if (type.flags & ts.TypeFlags.NumberLike) {
    out.push({ path: at, kind: 'number' });
    return;
  }
  if (seen.has(type)) return;
  seen.add(type);
  if (type.isUnion() || type.isIntersection()) {
    for (const member of type.types) walk(checker, member, at, seen, out);
    return;
  }
  if (!(type.flags & ts.TypeFlags.Object)) return;
  // Functions and methods are behavior, not data handed to the interface.
  if (type.getCallSignatures().length > 0) return;
  const name = type.getSymbol()?.getName();
  if (name === 'RegExp' || name === 'Promise' || name === 'AbortSignal') return;
  if (checker.isArrayType(type) || checker.isTupleType(type)) {
    for (const arg of checker.getTypeArguments(type as ts.TypeReference)) {
      walk(checker, arg, `${at}[]`, seen, out);
    }
    return;
  }
  for (const prop of checker.getPropertiesOfType(type)) {
    const propPath = at ? `${at}.${prop.getName()}` : prop.getName();
    if (RATING_NAME.test(prop.getName())) out.push({ path: propPath, kind: 'name' });
    walk(checker, checker.getTypeOfSymbol(prop), propPath, new Set(seen), out);
  }
}

function returnFindings(checker: ts.TypeChecker, symbol: ts.Symbol): Finding[] {
  const resolved = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  const type = checker.getTypeOfSymbol(resolved);
  const findings: Finding[] = [];
  for (const signature of type.getCallSignatures()) {
    const returned = signature.getReturnType();
    const awaited = checker.getAwaitedType(returned) ?? returned;
    walk(checker, awaited, '', new Set(), findings);
  }
  return findings;
}

describe('no scores in the public API', () => {
  const { checker, exports } = loadApi();
  const functions = exports.filter((symbol) => {
    const resolved =
      symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    return checker.getTypeOfSymbol(resolved).getCallSignatures().length > 0;
  });

  it('sees all six tasks', () => {
    const names = functions.map((s) => s.getName());
    for (const task of TASKS) expect(names).toContain(task);
  });

  it.each(TASKS)('%s returns no number but claim offsets', (task) => {
    const symbol = functions.find((s) => s.getName() === task);
    if (!symbol) throw new Error(`${task} is not exported`);
    const findings = returnFindings(checker, symbol);
    const numbers = findings.filter((f) => f.kind === 'number').map((f) => f.path);
    expect(numbers.filter((p) => !ALLOWED_NUMBER_PATHS.has(p))).toEqual([]);
    // The walk really did reach the offsets, so it is not passing vacuously.
    expect(numbers).toEqual(expect.arrayContaining([...ALLOWED_NUMBER_PATHS]));
  });

  it('no exported function returns a number or a rating-named field', () => {
    const problems: string[] = [];
    for (const symbol of functions) {
      const allowed = ALLOWED_RETURN_NUMBERS[symbol.getName()] ?? ALLOWED_NUMBER_PATHS;
      for (const finding of returnFindings(checker, symbol)) {
        if (finding.kind === 'number' && allowed.has(finding.path)) continue;
        problems.push(`${symbol.getName()}: ${finding.kind} at "${finding.path || '(return)'}"`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('no exported type has a field named like a rating', () => {
    const problems: string[] = [];
    for (const symbol of exports) {
      const resolved =
        symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
      if (!(resolved.flags & (ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Interface))) continue;
      const findings: Finding[] = [];
      walk(checker, checker.getDeclaredTypeOfSymbol(resolved), '', new Set(), findings);
      for (const f of findings)
        if (f.kind === 'name') problems.push(`${symbol.getName()}.${f.path}`);
    }
    expect(problems).toEqual([]);
  });
});

describe('no scores at runtime', () => {
  function numbersIn(value: unknown, at = ''): string[] {
    if (typeof value === 'number') return [at];
    if (Array.isArray(value)) return value.flatMap((v) => numbersIn(v, `${at}[]`));
    if (value && typeof value === 'object') {
      return Object.entries(value).flatMap(([k, v]) => numbersIn(v, at ? `${at}.${k}` : k));
    }
    return [];
  }

  it('no task result carries a number in its value', async () => {
    const options = { rulesOnly: true };
    const results = await Promise.all([
      localAi.rewriteBullet({ line: 'Posted 3 times a week for the club Instagram' }, options),
      localAi.followUpWhy(
        { track: 'career', topic: 'Nursing', answers: ['I like helping.'] },
        options
      ),
      localAi.likelyQuestions({ requirements: ['Experience with SQL', 'Teamwork'] }, options),
      localAi.messageVariants(
        { opener: 'I ran the radio.', role: 'Intern', company: 'Acme' },
        options
      ),
      localAi.translateWording({ phrase: "I ran the club's Instagram" }, options),
      localAi.interviewFollowUp({ question: 'Q', answer: 'We did it.' }, options),
    ]);
    for (const result of results) expect(numbersIn(result.value)).toEqual([]);
  });
});
