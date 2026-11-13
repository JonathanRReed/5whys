import { expect, it } from 'vitest';
import { computeSynthesis, validRootIndex } from '../src/components/career-5whys/shared';

const answers = [
  'i like marketing',
  'i like making things',
  'i guess i like making stuff people actually see',
  'because then it feels like it mattered',
  'idk if i would like doing it for a company',
];

it('uses the last answer as the root reason until the visitor picks another', () => {
  const synthesis = computeSynthesis(answers, 'Marketing', 'interest');
  expect(synthesis.root).toContain('idk if i would like doing it for a company');
  expect(synthesis.whyStatement).toContain('Working hypothesis from your final answer');
});

it('uses the answer the visitor picked as the real reason', () => {
  const synthesis = computeSynthesis(answers, 'Marketing', 'interest', 2);
  expect(synthesis.root).toContain('i guess i like making stuff people actually see');
  expect(synthesis.whyStatement).toContain('The reason you picked as the real one');
  expect(synthesis.whyStatement).not.toContain('idk if i would like');
});

it('ignores a choice that does not point at one of the five answers', () => {
  expect(validRootIndex(7)).toBeUndefined();
  expect(validRootIndex(-1)).toBeUndefined();
  expect(validRootIndex('2')).toBeUndefined();
  expect(computeSynthesis(answers, 'Marketing', 'interest', 9).root).toContain('idk if i would');
});
