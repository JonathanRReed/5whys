/**
 * The two answers from the career review on /start, kept so every tool can
 * default to the right register. Stored locally like everything else.
 */

export type CareerStage = 'student' | 'early' | 'mid' | 'senior' | 'transition';
export type CareerFocus =
  | 'direction'
  | 'applying'
  | 'resume'
  | 'starting'
  | 'interview'
  | 'networking';

/**
 * The stage as the visitor answered it. "High school or first job" is kept
 * as the student stage plus a flag, so every tool that reads the stage
 * already gives it the student register.
 */
export type StageAnswer = CareerStage | 'first-job';

export interface CareerProfile {
  stage: CareerStage;
  focus: CareerFocus;
  /** True when the answer was "High school or first job". Absent otherwise. */
  firstJob?: boolean;
  updatedAt: string;
}

export const PROFILE_STORAGE_KEY = 'career-tools-profile';

const STAGES: CareerStage[] = ['student', 'early', 'mid', 'senior', 'transition'];
const FOCUSES: CareerFocus[] = [
  'direction',
  'applying',
  'resume',
  'starting',
  'interview',
  'networking',
];

export const isStage = (value: unknown): value is CareerStage =>
  typeof value === 'string' && (STAGES as string[]).includes(value);
export const isFocus = (value: unknown): value is CareerFocus =>
  typeof value === 'string' && (FOCUSES as string[]).includes(value);
export const isStageAnswer = (value: unknown): value is StageAnswer =>
  value === 'first-job' || isStage(value);

/** The stage answer a profile was saved from. */
export const stageAnswer = (profile: Pick<CareerProfile, 'stage' | 'firstJob'>): StageAnswer =>
  profile.firstJob && profile.stage === 'student' ? 'first-job' : profile.stage;

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
      ...(data.firstJob === true && data.stage === 'student' ? { firstJob: true } : {}),
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** Forget the saved career review. */
export function clearProfile(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PROFILE_STORAGE_KEY);
  } catch {
    /* storage unavailable: there was nothing saved to forget */
  }
}

/** True when the last career review could not be saved on this device. */
export function profileSaved(profile: CareerProfile): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(PROFILE_STORAGE_KEY) === JSON.stringify(profile);
  } catch {
    return false;
  }
}

export function writeProfile(answer: StageAnswer, focus: CareerFocus): CareerProfile {
  const profile: CareerProfile =
    answer === 'first-job'
      ? { stage: 'student', focus, firstJob: true, updatedAt: new Date().toISOString() }
      : { stage: answer, focus, updatedAt: new Date().toISOString() };
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

export const STAGE_LABELS: Record<StageAnswer, string> = {
  'first-job': 'High school or first job',
  student: 'Student',
  early: 'Early career',
  mid: 'Mid-level',
  senior: 'Senior / Lead',
  transition: 'Transitioning',
};

export const FOCUS_LABELS: Record<CareerFocus, string> = {
  direction: 'Unclear direction',
  applying: 'Applying to a job',
  resume: 'Resume needs work',
  starting: 'Not much to show yet',
  interview: 'Interview prep',
  networking: 'Networking anxiety',
};
