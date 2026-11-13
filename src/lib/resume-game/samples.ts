import type { CareerStage } from '../profile';

/**
 * Sample resumes for the "try a sample" button. Each is deliberately weak:
 * the game is watching the score climb as a line gains a verb, a number, and
 * a result. The student sample also carries the structure a pasted resume
 * usually has (name, contact line, headings) so the detector's work is visible.
 */

export const STUDENT_SAMPLE_RESUME = `Jordan Lee
jordan.lee@example.edu · (555) 201-4477 · linkedin.com/in/jordanlee

EDUCATION
B.A. Communications, State University, expected May 2027 · GPA 3.6

EXPERIENCE
Social Media Assistant, Campus Radio Station, Sept 2025 – Present
Responsible for social media
Worked on the weekly newsletter with two other students
Helped with events during welcome week

Member, Marketing Club, 2024 – 2025
Participated in club meetings and the spring fundraiser

SKILLS
Canva, Google Sheets, Instagram, Spanish (conversational)`;

/**
 * The sample for anyone who is not a student: someone moving out of retail,
 * food service, warehouse, office, healthcare support, or customer service
 * work. Weak on purpose, like the student one.
 */
export const PROFESSIONAL_SAMPLE_RESUME = `Sam Rivera
sam.rivera@example.com · (555) 318-2290

EXPERIENCE
Shift Lead, Corner Market, March 2022 – Present
Responsible for opening and closing the store
Helped with inventory and freight
Worked on the weekly schedule for the front end
Handled customer complaints

SKILLS
Cash handling, scheduling, Excel, forklift certified`;

export const STUDENT_PLACEHOLDER = `Paste your whole resume, or just the bullets.

Class projects, internships, campus jobs, clubs, and volunteering all count. Lines like "Responsible for social media" are exactly what this tool is for.`;

export const PROFESSIONAL_PLACEHOLDER = `Paste your whole resume, or just the bullets.

Store, shift, warehouse, office, and customer work all count. Lines like "Responsible for opening and closing" are exactly what this tool is for.`;

/** Which set of examples to show. Students and early-career visitors, and anyone who has not said, get the student set. */
export type Register = 'student' | 'work';

export function registerForStage(stage: CareerStage | null | undefined): Register {
  return !stage || stage === 'student' || stage === 'early' ? 'student' : 'work';
}

/** Placeholders for the four rewrite fields, in the visitor's register. */
/** The example under the result field. Any example shown there must score as a result. */
export const RESULT_HINT_EXAMPLE = 'So customers waited less';

export const FIELD_PLACEHOLDERS: Record<
  Register,
  { verb: string; task: string; impact: string; quantifier: string }
> = {
  student: {
    verb: 'For example: Wrote, Ran, Tutored',
    task: "For example: the campus radio station's Instagram",
    impact: 'For example: so more students came to the Thursday show',
    quantifier: 'For example: 3 posts a week',
  },
  work: {
    verb: 'For example: Scheduled, Stocked, Trained',
    task: 'For example: the weekly schedule for the front end',
    impact: 'For example: so every shift was covered without overtime',
    quantifier: 'For example: 40 orders a shift',
  },
};
