/**
 * Plain-language meanings for the words a first-time visitor may not know.
 * One sentence each, said the way you would tell a friend. The "New word?" row
 * on a page reads from here, so a term means the same thing everywhere.
 */
export const GLOSSARY = {
  posting: {
    term: 'job posting',
    means:
      'The job ad: the page where an employer says what the job is and who they are looking for.',
  },
  bullet: {
    term: 'bullet',
    means: 'One line on a resume that says one thing you did.',
  },
  ats: {
    term: 'applicant tracking system',
    means:
      'Software many employers use to collect the resumes people send and search them. It is often called an ATS.',
  },
  decode: {
    term: 'decode',
    means: 'Sort a job ad into what it requires, what is nice to have, and what the work is.',
  },
  requirement: {
    term: 'requirement',
    means: 'Something the job ad says you need, such as a skill, a license or experience.',
  },
  hook: {
    term: 'hook',
    means:
      'The first line of a letter: something you did that makes the reader want the next line.',
  },
  story: {
    term: 'story',
    means: 'A short, true account of something you did, ready to tell when an interviewer asks.',
  },
  packet: {
    term: 'packet',
    means: 'The stories you picked for one job, kept together.',
  },
  hud: {
    term: 'cheat sheet (HUD)',
    means: 'One screen with your stories and key words, to glance at during a call.',
  },
  snapshot: {
    term: 'snapshot',
    means: 'A saved copy of your five answers as they are right now.',
  },
  whyStatement: {
    term: 'Why Statement',
    means: 'One sentence, built from your own answers, that says what you are after and why.',
  },
  basePay: {
    term: 'base pay',
    means: 'What you are paid before any bonus, tips or overtime.',
  },
  variablePay: {
    term: 'variable pay',
    means:
      'Money that is not promised, such as tips, commission, or a bonus that depends on results.',
  },
  overtime: {
    term: 'overtime',
    means:
      'Hours past a full week, which hourly jobs in the United States usually pay at a higher rate.',
  },
  rep: {
    term: 'rep',
    means: 'One practice run, start to finish. Short for repetition.',
  },
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
