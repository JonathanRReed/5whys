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
  /** What the line means and what the visitor can do about it. */
  note: string;
}

const CONDITIONS: readonly (HiringCondition & { pattern: RegExp; unless?: RegExp })[] = [
  {
    kind: 'security-clearance',
    label: 'Security clearance',
    pattern: /\bsecurity clearance\b|\b(?:secret|top secret|ts\/sci)\s+clearance\b/i,
    note: 'A clearance is granted through an employer or a government agency. You cannot apply for one yourself. If the posting says "ability to obtain", you do not need to hold one yet.',
  },
  {
    kind: 'work-authorization',
    label: 'Work authorization',
    pattern:
      /\bsponsor(?:ship|ed|s|ing)?\b[^.]*\b(?:visa|employment|work|authori[sz]ation)|\bvisas?\b|\bwork authori[sz]ation\b|\b(?:legally\s+)?(?:authori[sz]ed|eligible|permitted|entitled)\s+to\s+work\b|\bright to work\b|\b(?:u\.?s\.?|united states)\s+citizen(?:s|ship)?\b|\bgreen card\b|\bpermanent residen(?:t|ts|cy)\b/i,
    note: "This asks whether you may legally work in the country, and whether the employer would need to sponsor a visa. It is not a skill and does not go on a resume. Answer truthfully when the application asks. If you study on a visa, your school's international student office can tell you what work you are allowed to do.",
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
    pattern: /\bdigital natives?\b|\brecent (?:college |university )?grad(?:uate)?s?\b|\byoung\b/i,
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
  for (const { pattern, unless, kind, label, note } of CONDITIONS) {
    if (pattern.test(text) && !unless?.test(text)) return { kind, label, note };
  }
  return null;
}
