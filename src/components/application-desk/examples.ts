import * as React from 'react';
import { isStudentLike, readProfile } from '../../lib/profile';

/** The worked examples a station shows. Nothing here is the visitor's own text. */
export interface DeskExamples {
  experienceHelp: string;
  experiencePlaceholder: string;
  impactPlaceholder: string;
  /** One placeholder per bullet box, so the two never read the same. */
  bulletPlaceholders: readonly [string, string];
  /** For the draft fields: a verb, what was done, what happened. */
  draft: { verb: string; task: string; result: string };
  /** A hook that starts with something done, shown when the opener is generic. */
  hook: string;
  /** A finished letter: greeting, four parts, sign-off. */
  letter: readonly string[];
  /** Placeholders for the role and employer on the start form. */
  role: string;
  company: string;
  /** A specific step for the action plan, against "Network", which is not one. */
  actionStep: string;
}

const STUDENT: DeskExamples = {
  experienceHelp:
    'It does not have to be a job. A class project, a part-time role, a club, volunteering, or something you built on your own all count. Say what it was, what you did, and how it connects to what this employer wants.',
  experiencePlaceholder: 'I ran social media for the campus radio station for a year...',
  impactPlaceholder:
    'Because of the weekly schedule I set up, volunteers stopped missing shifts...',
  bulletPlaceholders: [
    'Counted and balanced my register drawer at the end of every shift',
    'Showed two new cashiers how to open the register in their first week',
  ],
  draft: {
    verb: 'Ran',
    task: "the club's weekly sign-up table",
    result: 'more first-years came to the second meeting',
  },
  hook: "Over the last year I grew my club's Instagram into a real community, and I would love to do that for your team.",
  letter: [
    'Dear Ms. Okafor,',
    "Last spring I rebuilt my campus food pantry's sign-up sheet so that volunteers stopped missing shifts, and I would like to bring that same care to the Program Assistant role at Riverside Food Bank.",
    'Scheduling: I moved 30 volunteers from a paper list to a shared calendar and sent a reminder the night before each shift. Communication: I wrote the weekly update that went to every volunteer. Reliability: I opened the pantry every Tuesday for two semesters.',
    'Your mobile pantry stood out to me because it reaches students who cannot get to a fixed site, which was the problem I kept hearing about on my own campus.',
    'Thank you for considering my application. Could we talk for 15 minutes about how I could help with volunteer scheduling this fall?',
    'Sincerely, Sam Alvarez',
  ],
  role: 'Marketing intern',
  company: 'Riverside Food Bank',
  actionStep: 'Schedule three informational interviews before the end of the term',
};

/** For someone with years of work behind them, often in another field. */
const WORKING: DeskExamples = {
  experienceHelp:
    'Pick the work that is closest to this job, even if the title or the field was different. Say what it was, what you did, and how it connects to what this employer wants.',
  experiencePlaceholder: 'I ran the evening shift at a distribution warehouse for six years...',
  impactPlaceholder:
    'Because I changed how the handover between shifts was written down, late orders stopped slipping to the next day...',
  bulletPlaceholders: [
    'Cut late orders from 40 a week to 6 by rewriting the handover between shifts',
    'Trained new pickers on the scanners so they reached full pace in their first week',
  ],
  draft: {
    verb: 'Rewrote',
    task: 'the handover notes between the day and evening shifts',
    result: 'late orders stopped slipping to the next day',
  },
  hook: 'For six years I ran an evening shift where forty orders a week used to go out late, and I got that down to six. I would like to bring that to your operations team.',
  letter: [
    'Dear Mr. Haddad,',
    'For six years I ran the evening shift at a distribution warehouse, where I cut late orders from forty a week to six. I would like to bring that to the Project Coordinator role at Northgate Health.',
    'Scheduling: I planned shifts for 22 people and covered absences the same day. Clear handovers: I rewrote the notes passed between shifts so that nothing waited until morning. Working with other teams: I met with purchasing and transport every week to settle what was arriving and when.',
    'I am moving from logistics into healthcare because your clinics depend on the same thing my warehouse did: the right supplies in the right room before they are needed. Your new clinic openings are the kind of work I am used to.',
    'Thank you for considering my application. Could we talk for 20 minutes about the clinic openings planned for next year?',
    'Sincerely, Dana Whitfield',
  ],
  role: 'Operations coordinator',
  company: 'Northgate Health',
  actionStep: 'Schedule three informational interviews before the end of the month',
};

/**
 * Examples for the visitor's stage. Student examples until a saved profile
 * says otherwise, so a first-time visitor is never shown a professional's.
 */
export function useDeskExamples(): DeskExamples {
  const [examples, setExamples] = React.useState(STUDENT);
  React.useEffect(() => {
    const profile = readProfile();
    if (profile && !isStudentLike(profile)) setExamples(WORKING);
  }, []);
  return examples;
}
