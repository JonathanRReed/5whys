/**
 * Conditions of hiring: posting lines that are about who may be hired, not
 * about what a person can do. "Unable to sponsor visas" is not a skill to
 * have or to get, and "native English speaker" is not one a person can earn.
 *
 * The desk shows these apart from the qualifications, with a plain note on
 * what the line means and what to do about it. Legal statements are limited
 * to the United States and worded as what the law covers, never as advice on
 * a person's own case.
 */

export type ConditionKind =
  | 'work-authorization'
  | 'citizenship'
  | 'security-clearance'
  | 'native-speaker'
  | 'minimum-age'
  | 'age-coded'
  | 'background-check'
  | 'physical';

export interface HiringCondition {
  kind: ConditionKind;
  /** A short name for the kind of line. */
  label: string;
  /** What this line means and what the visitor can do about it. Short, so it can sit under every line. */
  note: string;
  /**
   * The terms behind the note ("F-1", "OPT", "I-9"), for a page to show once
   * however many lines of the kind a posting has.
   */
  about?: string;
  /**
   * The line says the employer will not sponsor a visa ("We are unable to
   * sponsor", "without sponsorship"). A posting can say this apart from, or
   * together with, asking for work authorization.
   */
  noSponsorship?: boolean;
}

/** "We do not sponsor visas", "unable to sponsor", "without sponsorship", "sponsorship is not available". */
const NO_SPONSORSHIP = new RegExp(
  [
    // The refusal and the word it refuses stay together: "No prior experience
    // required; visa sponsorship is available" refuses nothing about visas.
    String.raw`\b(?:unable\s+to|not\s+able\s+to|cannot|can\s?not|can't|won't|will\s+not|do\s+not|does\s+not|don't|doesn't|are\s+not|is\s+not|must\s+not|not)\s+(?:(?:currently|presently|be|able|to|offer|offering|provide|providing|or|any|consider|considering|require|requiring|need|needing|eligible|for|a|an|the)\s+){0,5}(?:(?:visa|work|employment|immigration|h-?1b|new)\s+){0,2}sponsor`,
    String.raw`\bno\s+(?:(?:visa|work|employment|immigration|h-?1b|new)\s+){0,2}sponsor`,
    String.raw`\bwithout\s+(?:\w+\s+)?sponsorship\b`,
    String.raw`\bsponsorship\s+(?:is\s+)?(?:not\s+(?:available|offered|provided|possible)|unavailable)\b`,
  ].join('|'),
  'i'
);
const WORK_AUTHORIZATION_ABOUT =
  'F-1, J-1, and H-1B are visa types; CPT and OPT are kinds of work permission for students on an F-1 visa. An I-9 is the form US employers use to check work eligibility at hiring, and a Social Security number is used for pay and tax records. None of this is a skill or goes on a resume.';

const NO_SPONSORSHIP_NOTE =
  "This employer says it will not sponsor a work visa. If you will need sponsorship, now or after OPT ends, ask the recruiter before you spend time on the letter. Your school's international student office can tell you what work you may do.";

const CONDITIONS: readonly (HiringCondition & {
  pattern: RegExp;
  /** A case-sensitive pattern tried as well, for acronyms. */
  exact?: RegExp;
  unless?: RegExp;
})[] = [
  {
    kind: 'security-clearance',
    label: 'Security clearance',
    pattern: /\bsecurity clearance\b|\b(?:secret|top secret|ts\/sci)\s+clearance\b/i,
    note: 'A clearance is granted through an employer or a government agency. You cannot apply for one yourself. If the posting says "ability to obtain", you do not need to hold one yet.',
  },
  {
    kind: 'citizenship',
    label: 'Citizenship',
    pattern:
      /\b(?:u\.?s\.?|united states|american|canadian|british|uk|eu)\s+citizen(?:s|ship)?\b|\bcitizenship\s+(?:is\s+)?required\b|\bmust\s+(?:be|hold)\s+(?:an?\s+)?(?:\w+\s+)?citizen(?:ship)?\b|\brequires?\s+(?:\w+\s+)?citizenship\b/i,
    note: "This job is open only to citizens, often because of a government contract or a security rule. It is about citizenship, not a visa, so sponsorship does not apply to it. It is not a skill and does not go on a resume. Answer truthfully when the application asks. If you study on a visa, your school's international student office can tell you what work you may do.",
  },
  {
    kind: 'work-authorization',
    label: 'Work authorization',
    pattern:
      /\bsponsor(?:ship|ed|s|ing)?\b[^.]*\b(?:visa|employment|work|authori[sz]ation)|\b(?:require|requires|need|needs)\s+(?:visa\s+|employment\s+|immigration\s+)?sponsorship\b|\bsponsorship\b[^.]*\bnow or in the future\b|\bsponsorship\s+(?:is\s+)?(?:not\s+(?:available|offered|provided|possible)|unavailable)\b|\bvisas?\b|\bwork authori[sz]ation\b|\b(?:legally\s+)?(?:authori[sz]ed|eligible|permitted|entitled)\s+to\s+work\b|\bright to work\b|\bgreen card\b|\bpermanent residen(?:t|ts|cy)\b|\bh-?1b\b|\bsocial security (?:number|card)\b|\bstem opt\b/i,
    // Case matters for these: "OPT" is a student work permission, "opt in" is not.
    exact:
      /\bOPT\b|\b[FJ]-1\b|\bSSN\b|\bI-9\b|\bEAD\b|\bCPT\b(?=[^.]*\b(?:OPT|F-1|J-1|visas?|students?|authori[sz]ation)\b)|\b(?:OPT|F-1|J-1|visas?|students?)\b[^.]*\bCPT\b/,
    note: "This asks whether you may legally work in the country. It is not a skill and does not go on a resume. Answer truthfully when the application asks. If you study on a visa, your school's international student office can tell you what work you may do.",
    about: WORK_AUTHORIZATION_ABOUT,
  },
  {
    kind: 'native-speaker',
    label: 'Language and origin',
    pattern: /\bnative\s+(?:[a-z]+\s+)?speakers?\b|\bmother tongue\b/i,
    note: 'A job can require fluency. "Native speaker" describes where someone grew up, not how well they speak, and under US equal employment law it can be national origin discrimination. If you are fluent, you meet what the job can fairly need. Show the fluency: work, study, or writing done in the language.',
  },
  {
    kind: 'age-coded',
    label: 'Age wording',
    // "Young" only where it describes who is wanted ("a young, energetic
    // team", "young professional"), not who the work is with ("young children").
    pattern:
      /\bdigital natives?\b|\brecent (?:college |university )?grad(?:uate)?s?\b|\byoung(?:,| and)?\s+(?:(?:energetic|dynamic|ambitious|motivated|vibrant|hungry|fun)\s+)?(?:team|company|compan(?:y|ies)|start-?up|culture|environment|professionals?|candidates?|talent|graduates?|person|individuals?|go-getters?)\b/i,
    note: 'Wording like this can read as a preference for younger people. US law protects workers aged 40 and over from age discrimination in hiring. If you can do the work, you can apply.',
  },
  {
    kind: 'minimum-age',
    label: 'Minimum age',
    pattern:
      /\b(?:must be|be at least|at least|minimum age(?: of)?)\s+(?:1[4-9]|2[01])\b(?!\s*\+?\s*years?\s+(?:of\s+)?(?:[a-z-]+\s+){0,3}experience)|\b(?:1[4-9]|2[01])\s*(?:\+(?!\s*years?\s+(?:of\s+)?(?:[a-z-]+\s+){0,3}experience)|(?:years?(?: of age| old)?\s+)?(?:or|and) (?:older|over)\b)/i,
    note: 'A minimum age, usually set by law or by insurance for the work. You meet it or you do not. Leave your age off the resume.',
  },
  {
    kind: 'background-check',
    label: 'Background check',
    pattern:
      /\bbackground (?:check|screen(?:ing)?|investigation)s?\b|\bdrug (?:test|screen)(?:ing)?s?\b|\bcriminal (?:record|history)\b|\be-?verify\b/i,
    // Doing this work is a skill: "Experience in drug testing procedures",
    // "Conduct background checks for new hires".
    unless:
      /\b(?:experience|knowledge|familiar(?:ity)?|skilled|proficien\w+|expertise|conduct\w*|administer\w*|perform\w*|process\w*|review\w*|run|running|manage\w*|coordinat\w*)\b[^.]*\b(?:background|drug|criminal|e-?verify)/i,
    note: 'A check made during hiring, often after an offer. There is nothing to put on a resume. If you have a record, a legal aid office or a reentry program can explain what an employer where you live may ask and when.',
  },
  {
    kind: 'physical',
    label: 'Physical duty',
    pattern:
      /\b(?:lift|carry|move)\b[^.]*\b\d+\s*(?:pounds?|lbs?|kg|kilos?)\b|\bstand(?:ing)?\s+for\b|\bon (?:your|their) feet\b|\bphysical(?:ly)?\s+(?:demands?|requirements?|able|fit)\b/i,
    note: 'A physical duty of the job. It does not go on a resume. In the United States an employer must consider a reasonable accommodation for a disability, and you can ask about one.',
  },
];

/** The condition a posting line states, or null when it is an ordinary qualification. */
export function hiringCondition(text: string): HiringCondition | null {
  for (const { pattern, exact, unless, kind, label, note, about } of CONDITIONS) {
    if ((pattern.test(text) || exact?.test(text)) && !unless?.test(text)) {
      if (kind === 'work-authorization' && NO_SPONSORSHIP.test(text)) {
        return {
          kind,
          label: 'Visa sponsorship',
          note: NO_SPONSORSHIP_NOTE,
          about: WORK_AUTHORIZATION_ABOUT,
          noSponsorship: true,
        };
      }
      return { kind, label, note, ...(about ? { about } : {}) };
    }
  }
  return null;
}

/**
 * Splits items into the ones a resume can show and the conditions of hiring.
 * Every place that counts confirmed requirements uses this, so a minimum age
 * or a visa line is never one of the "N of M".
 */
export function splitConditions<T extends { text: string }>(
  items: readonly T[]
): { requirements: T[]; conditions: T[] } {
  const requirements: T[] = [];
  const conditions: T[] = [];
  for (const item of items) (hiringCondition(item.text) ? conditions : requirements).push(item);
  return { requirements, conditions };
}
