import { describe, expect, it } from 'vitest';
import {
  buildDeepSignalReport,
  computeKeywordDensity,
  detectAtsKeywords,
} from '../src/lib/resume-game/analysis';
import { extractSkills } from '../src/lib/resume-game/skills';

describe('resume analysis result isolation', () => {
  it('does not reuse mutated keyword entries or their containing array', () => {
    const text = 'Banana banana pear';
    const first = computeKeywordDensity(text);
    expect(first).toEqual([
      { word: 'banana', count: 2 },
      { word: 'pear', count: 1 },
    ]);

    first[0].word = 'changed';
    first[0].count = 99;
    first.push({ word: 'invented', count: 10 });

    expect(computeKeywordDensity(text)).toEqual([
      { word: 'banana', count: 2 },
      { word: 'pear', count: 1 },
    ]);
  });

  it('does not let callers change later ATS keyword results', () => {
    const text = 'Leadership with Python';
    const first = detectAtsKeywords(text);
    expect(first).toEqual(['leadership', 'python']);

    first.splice(0, first.length, 'invented');

    expect(detectAtsKeywords(text)).toEqual(['leadership', 'python']);
    expect(detectAtsKeywords('SQL')).toEqual(['sql']);
  });

  it('returns independent hard and soft skill arrays on repeated analysis', () => {
    const text = 'Python and communication';
    const first = extractSkills(text);
    expect(first).toEqual({ hard: ['python'], soft: ['communication'] });

    first.hard.push('invented');
    first.soft.length = 0;

    expect(extractSkills(text)).toEqual({ hard: ['python'], soft: ['communication'] });
  });

  it('does not reuse an object after a caller replaces its skill arrays', () => {
    const text = 'SQL and teamwork';
    const first = extractSkills(text);
    expect(first).toEqual({ hard: ['sql'], soft: ['teamwork'] });

    first.hard = ['invented'];
    first.soft = [];

    expect(extractSkills(text)).toEqual({ hard: ['sql'], soft: ['teamwork'] });
  });

  it('does not share mutable skills or density entries between signal reports', () => {
    const text = 'Python Python leadership';
    const first = buildDeepSignalReport([], text);
    const firstDensity = first.keywordDensity ?? [];
    expect(first.hardSkills).toEqual(['python']);
    expect(first.softSkills).toEqual(['leadership']);
    expect(firstDensity).toEqual([
      { word: 'python', count: 2 },
      { word: 'leadership', count: 1 },
    ]);

    first.hardSkills.push('invented');
    first.softSkills.length = 0;
    firstDensity[0].count = 99;

    const second = buildDeepSignalReport([], text);
    expect(second.hardSkills).toEqual(['python']);
    expect(second.softSkills).toEqual(['leadership']);
    expect(second.keywordDensity).toEqual([
      { word: 'python', count: 2 },
      { word: 'leadership', count: 1 },
    ]);
  });

  it('keeps empty analysis results empty after earlier results are edited', () => {
    computeKeywordDensity('').push({ word: 'invented', count: 1 });
    detectAtsKeywords('').push('invented');
    extractSkills('').hard.push('invented');
    extractSkills('').soft.push('invented');

    expect(computeKeywordDensity('')).toEqual([]);
    expect(detectAtsKeywords('')).toEqual([]);
    expect(extractSkills('')).toEqual({ hard: [], soft: [] });
  });
});
