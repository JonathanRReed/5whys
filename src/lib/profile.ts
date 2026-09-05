/**
 * The two answers from the career review on /start, kept so every tool can
 * default to the right register. Stored locally like everything else.
 */

export type CareerStage = 'student' | 'early' | 'mid' | 'senior' | 'transition';
export type CareerFocus = 'direction' | 'resume' | 'interview' | 'networking';

export interface CareerProfile {
  stage: CareerStage;
  focus: CareerFocus;
  updatedAt: string;
}

export const PROFILE_STORAGE_KEY = 'career-tools-profile';

const STAGES: CareerStage[] = ['student', 'early', 'mid', 'senior', 'transition'];
const FOCUSES: CareerFocus[] = ['direction', 'resume', 'interview', 'networking'];

export const isStage = (value: unknown): value is CareerStage =>
  typeof value === 'string' && (STAGES as string[]).includes(value);
export const isFocus = (value: unknown): value is CareerFocus =>
  typeof value === 'string' && (FOCUSES as string[]).includes(value);

export function readProfile(): CareerProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<CareerProfile>;
    if (!isStage(data.stage) || !isFocus(data.focus)) return null;
    return {
      stage: data.stage,
      focus: data.focus,
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeProfile(stage: CareerStage, focus: CareerFocus): CareerProfile {
  const profile: CareerProfile = { stage, focus, updatedAt: new Date().toISOString() };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      /* storage unavailable: the recommendation still shows for this visit */
    }
  }
  return profile;
}

/** Students and early-career people get the student register everywhere. */
export function isStudentLike(profile: CareerProfile | null): boolean {
  return profile?.stage === 'student' || profile?.stage === 'early';
}

export const STAGE_LABELS: Record<CareerStage, string> = {
  student: 'Student',
  early: 'Early career',
  mid: 'Mid-level',
  senior: 'Senior / Lead',
  transition: 'Transitioning',
};

export const FOCUS_LABELS: Record<CareerFocus, string> = {
  direction: 'Unclear direction',
  resume: 'Resume needs work',
  interview: 'Interview prep',
  networking: 'Networking anxiety',
};
