import type { CareerProfile, CareerStage } from '../profile';

/**
 * Who a question or an example suits. Read from the career review's stage;
 * a visitor who never took it is treated as a student, the site's default
 * register.
 */
export type Audience = 'student' | 'early-career' | 'experienced' | 'career-changer';

export const AUDIENCES: readonly Audience[] = [
  'student',
  'early-career',
  'experienced',
  'career-changer',
];

export function audienceForStage(stage: CareerStage | null | undefined): Audience {
  switch (stage) {
    case 'early':
      return 'early-career';
    case 'mid':
    case 'senior':
      return 'experienced';
    case 'transition':
      return 'career-changer';
    default:
      return 'student';
  }
}

export function audienceForProfile(profile: CareerProfile | null | undefined): Audience {
  return audienceForStage(profile?.stage);
}

/** Students and early-career visitors share the student examples. */
export function usesStudentExamples(audience: Audience): boolean {
  return audience === 'student' || audience === 'early-career';
}
