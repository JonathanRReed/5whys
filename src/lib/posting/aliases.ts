/**
 * How skill-bank keywords behave when the engine looks for evidence. The
 * keywords themselves live in glowup-banks.ts and stay the single source;
 * this file only says which of them name a whole skill, which are too
 * ambiguous to count, and which spellings mean the same thing.
 */

/**
 * Keywords that name a skill broadly. When a requirement uses one, any
 * keyword of that skill counts as evidence: "Python" is shown by "pandas".
 * A narrow keyword ("Tableau") is only shown by itself and its synonyms.
 * Only tool skills are read this way when looking for evidence (see
 * TOOL_SKILLS in match.ts): a soft or domain umbrella ("leadership" shown by
 * "coach") made unrelated lines count, so the soft and domain entries below
 * are kept for reference but no longer widen a match.
 */
export const UMBRELLA_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  python: ['python'],
  javascript: ['javascript', 'js'],
  java: ['java'],
  sql: ['sql', 'database', 'databases'],
  cloud: ['cloud'],
  ml: ['machine learning', 'ml', 'ai'],
  security: ['security', 'cybersecurity'],
  devops: ['devops', 'ci/cd'],
  api: ['api', 'apis'],
  frontend: ['frontend', 'front-end'],
  backend: ['backend', 'back-end'],
  mobile: ['mobile'],
  'data-analysis': ['data analysis', 'analytics'],
  communication: ['communication', 'communicate'],
  leadership: ['leadership'],
  teamwork: ['teamwork', 'collaborate', 'collaboration', 'team player'],
  'problem-solving': ['problem solving', 'problem-solving', 'critical thinking'],
  adaptability: ['adaptability'],
  'time-management': ['time management'],
  ownership: ['ownership'],
  'attention-to-detail': ['attention to detail', 'detail-oriented'],
  agile: ['agile'],
  ux: ['ux', 'user experience'],
  finance: ['finance'],
  healthcare: ['healthcare'],
  ecommerce: ['ecommerce', 'e-commerce', 'retail'],
};

/**
 * Skill-bank keywords that are fine for tagging a line on the decode screen
 * but too ambiguous to stand as a requirement term or as evidence: "change",
 * "quality", "vision" (as in vision insurance), "pivot" (as in pivot tables),
 * "spring" (as in spring semester), "server" (as in restaurant server).
 */
export const WEAK_SKILL_KEYWORDS: ReadonlySet<string> = new Set([
  'change',
  'quality',
  'vision',
  'pivot',
  'spring',
  'server',
  'product',
  'requirements',
  'present',
  'written',
  'verbal',
  'responsive',
  'flexible',
  'fast-paced',
  'self-starter',
  'influence',
  'lead',
  'leading',
  'manage',
  'organize',
  'initiative',
  'ts',
]);

/**
 * Words that only count when capitalized, because the lowercase form is an
 * ordinary word: "Excel" the program, not "excel at".
 */
export const CAPITALIZED_ONLY: ReadonlySet<string> = new Set([
  'excel',
  'swift',
  'flask',
  'outlook',
  'lean',
]);

/**
 * Spellings that mean the same thing. The first entry is the canonical form.
 * Matching already tolerates plural, -ing, -ed, and space or hyphen
 * differences, so only true alternatives are listed.
 */
export const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ['javascript', 'js'],
  ['typescript', 'ts'],
  ['frontend', 'front-end'],
  ['backend', 'back-end'],
  ['ecommerce', 'e-commerce'],
  ['problem solving', 'problem-solving'],
  ['machine learning', 'ml'],
  ['ai', 'artificial intelligence'],
  ['postgresql', 'postgres'],
  ['kubernetes', 'k8s'],
  ['excel', 'microsoft excel', 'ms excel'],
  ['power bi', 'powerbi'],
  ['powerpoint', 'microsoft powerpoint'],
  ['microsoft office', 'ms office', 'microsoft 365', 'office 365'],
  ['google sheets', 'google spreadsheets'],
  ['point of sale', 'pos'],
  ['customer service', 'customer support'],
  ['cash handling', 'handling cash', 'cash register'],
  ["bachelor's", 'bachelors', 'bachelor', 'b.s.', 'b.a.', 'b.sc.', 'bs', 'ba'],
  // Bare "masters" is left out: "item masters" is a data term, not a degree.
  ["master's", 'masters degree', 'm.s.', 'm.a.', 'm.sc.'],
  ['high school diploma', 'ged'],
  ['gpa', 'grade point average'],
  ['cpr', 'cardiopulmonary resuscitation'],
  ['ci/cd', 'continuous integration'],
  // Degree levels beyond the bachelor's and master's above. "Associate" alone
  // is a job title ("Sales Associate"), so only the degree forms count.
  [
    "associate's degree",
    'associate degree',
    'associate of applied science',
    'associate of arts',
    'associate of science',
  ],
  ['phd', 'ph.d.', 'doctorate'],
  ['mba', 'master of business administration'],
  // Operations systems and the category phrase each one goes by.
  ['warehouse management system', 'wms', 'warehouse management software'],
  ['transportation management system', 'tms', 'transportation management software'],
  ['enterprise resource planning', 'erp'],
  ['customer relationship management', 'crm'],
  ['electronic data interchange', 'edi'],
  ['project management tools', 'project management tool', 'project management software'],
  ['ms project', 'microsoft project'],
  ['microsoft word', 'ms word'],
  ['microsoft outlook', 'outlook'],
  ['google workspace', 'g suite', 'google docs'],
  ['pivot tables', 'pivot table', 'pivottable'],
  ['vlookup'],
  ['xlookup'],
  ['quickbooks', 'intuit quickbooks'],
  ['kronos', 'ukg'],
  ['salesforce'],
  ['six sigma', 'lean six sigma'],
  ['lean', 'lean manufacturing'],
  ['capm', 'certified associate in project management'],
  ['pmp', 'project management professional'],
  ['forklift certification', 'forklift certified', 'forklift license'],
  ['servsafe', 'servsafe manager'],
  ['osha 10', 'osha 10-hour', 'osha 30', 'osha 30-hour'],
  ['first aid'],
  ['data entry'],
  ["driver's license", 'drivers license', 'driver license'],
];

const GROUP_BY_MEMBER: ReadonlyMap<string, readonly string[]> = (() => {
  const map = new Map<string, readonly string[]>();
  for (const group of SYNONYM_GROUPS) {
    for (const member of group) map.set(member, group);
  }
  return map;
})();

/** The synonym group a spelling belongs to, or the spelling alone. */
export function synonymsOf(term: string): readonly string[] {
  return GROUP_BY_MEMBER.get(term.toLowerCase()) ?? [term.toLowerCase()];
}

/** The canonical spelling for a term: the first entry of its synonym group. */
export function canonicalTerm(term: string): string {
  return synonymsOf(term)[0];
}
