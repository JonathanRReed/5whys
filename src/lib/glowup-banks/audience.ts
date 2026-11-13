import { readDocument } from '../posting/resume-lines';
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

/** Years of dated work at which a visitor with no saved profile stops being read as a student. */
const SEASONED_YEARS = 8;

/**
 * Who the questions and examples are for. A saved career review decides. With
 * none, the resume can still say something: someone whose dated work goes
 * back many years should not be asked about coursework. It never guesses a
 * career change; that is the visitor's to say, in the career review or by
 * adding those questions in the room.
 */
export function audienceFor(
  profile: CareerProfile | null | undefined,
  resumeText = '',
  today: Date = new Date()
): Audience {
  if (profile?.stage) return audienceForStage(profile.stage);
  if (!resumeText.trim()) return 'student';
  const starts = readDocument(resumeText, { today }).roles.map(
    (role) => role.from.year * 12 + role.from.month
  );
  if (starts.length === 0) return 'student';
  const months = today.getFullYear() * 12 + today.getMonth() + 1 - Math.min(...starts);
  return months >= SEASONED_YEARS * 12 ? 'experienced' : 'student';
}
