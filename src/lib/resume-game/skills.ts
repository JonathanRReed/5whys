import { HARD_SKILLS, matchesTerm, SOFT_SKILLS } from './constants';

/**
 * Skill detection with context gates. Short or common-word skill names only
 * count with supporting context, so "Spring 2024" is a semester, "R" in
 * "R. Smith" is an initial, and "go" is a verb unless it sits in a language
 * list. Everything else matches on word boundaries as before.
 */
// Fast-path substring precheck map for context-gated skills to avoid executing RegExp evaluation when key tokens are absent.
const SKILL_GATE_PRECHECK: Record<string, string[]> = {
  spring: ['spring'],
  go: ['go'],
  r: ['r', 'rstudio'],
  express: ['express'],
  chef: ['chef'],
  shell: ['shell', 'bash', 'zsh'],
  oracle: ['oracle', 'pl/sql'],
  unity: ['unity'],
  sas: ['sas'],
  lean: ['lean', 'six sigma'],
  sketch: ['sketch'],
  notion: ['notion'],
  lambda: ['lambda'],
  sem: ['sem'],
  premiere: ['premiere'],
  git: ['git'],
  documentation: ['documentation'],
};

// Context gate matchers optimized to eliminate unbounded [\s\S]* lookaheads and RegExp backtracking.
const SKILL_CONTEXT: Record<string, (text: string, lowerText: string) => boolean> = {
  spring: (text, lowerText) =>
    lowerText.includes('spring') &&
    /spring\s*(boot|framework|mvc|cloud|security|data)\b/i.test(text),
  go: (text, lowerText) =>
    lowerText.includes('go') &&
    /\bgolang\b|\bgo\s*(?:lang|programming|routines?)\b|\b(?:python|java|rust|typescript|javascript|c\+\+|c#|kotlin|swift|ruby|r|scala)\s*(?:,|\/|and|&)\s*go\b(?=\s*(?:,|\/|;|\.|and|&|$))|\bgo\s*(?:,|\/)\s*(?:python|java|rust|typescript|javascript|c\+\+|c#|kotlin|swift|ruby|r|scala)\b/i.test(
      text
    ),
  r: (text) =>
    /\br\s*(?:studio|programming|language|markdown|shiny)\b|\brstudio\b|\b(?:python|sas|spss|stata|matlab|sql|excel|go|java|julia)\s*(?:,|\/|and|&)\s*r\b(?=\s*(?:,|\/|;|\.|and|&|$))|\br\s*(?:,|\/)\s*(?:python|sas|spss|stata|matlab|sql|excel|go|java|julia)\b|\bin r\b(?=\s*(?:,|\.|;|$|and|for|to))|\busing r\b/i.test(
      text
    ),
  express: (text, lowerText) =>
    lowerText.includes('express') &&
    /express\.?js\b|\bexpress\s*(?:framework|server|api|app|router)\b|\bnode(?:\.js)?\s*(?:\/|,|and|\+|&)\s*express\b/i.test(
      text
    ),
  chef: (text, lowerText) =>
    lowerText.includes('chef') &&
    /\bchef\b/i.test(text) &&
    /\b(?:cookbook|recipe|ansible|puppet|terraform|infrastructure|devops|automation|provision)\b/i.test(
      text
    ),
  shell: (text) =>
    /shell\s*(?:script|scripting|commands?)\b|\bbash\b|\bzsh\b|\bunix shell\b/i.test(text),
  oracle: (text) =>
    /oracle\s*(?:database|db|sql|cloud|erp|apex|fusion|netsuite|11g|12c|19c)\b|\bpl\/sql\b/i.test(
      text
    ),
  unity: (text, lowerText) =>
    lowerText.includes('unity') &&
    (/unity\s*(?:3d|engine|game|editor|project|scripts?)\b|\bunity3d\b/i.test(text) ||
      (matchesTerm(text, 'c#', lowerText, 'c#') && /\bunity\b/i.test(text))),
  sas: (text, lowerText) =>
    lowerText.includes('sas') &&
    (/\bsas\s*(?:studio|enterprise|programming|base|viya)\b/i.test(text) ||
      (/\bsas\b/i.test(text) &&
        /\b(?:statistic|statistical|data analysis|analytics|spss|stata|regression)\b/i.test(text))),
  lean: (text) =>
    /\blean\s*(?:manufacturing|six sigma|methodology|principles|startup|process|management)\b|\bsix sigma\b/i.test(
      text
    ),
  sketch: (text, lowerText) =>
    lowerText.includes('sketch') &&
    /\bsketch\b/i.test(text) &&
    /\b(?:figma|design|prototype|wireframe|ui|ux|invision|zeplin)\b/i.test(text),
  notion: (text, lowerText) =>
    lowerText.includes('notion') &&
    (/\bnotion\.so\b/i.test(text) ||
      (/\bnotion\b/i.test(text) &&
        /\b(?:workspace|wiki|database|template|jira|confluence|asana|trello|docs)\b/i.test(text))),
  lambda: (text, lowerText) =>
    lowerText.includes('lambda') &&
    (/\baws lambda\b|\blambda\s*functions?\b/i.test(text) ||
      (/\bserverless\b/i.test(text) && /\blambda\b/i.test(text))),
  sem: (text, lowerText) =>
    lowerText.includes('sem') &&
    /\bsem\b/i.test(text) &&
    /\b(?:seo|ppc|google ads|adwords|paid search|search marketing|campaigns?)\b/i.test(text),
  premiere: (text, lowerText) =>
    lowerText.includes('premiere') && /premiere\s*pro\b|\badobe premiere\b/i.test(text),
  git: (text, lowerText) => lowerText.includes('git') && /\bgit\b(?!hub|lab)/i.test(text),
  documentation: (text, lowerText) =>
    lowerText.includes('documentation') &&
    /\b(?:wrote|write|writing|maintained|authored|created|technical)\s+documentation\b|\bdocumentation\s+(?:for|of|site)\b/i.test(
      text
    ),
};

// Pre-computed lowercased skill entries to avoid string allocation on every extractSkills execution.
const HARD_SKILLS_ENTRIES = HARD_SKILLS.map((skill) => ({
  skill,
  lowerSkill: skill.toLowerCase(),
}));

const SOFT_SKILLS_ENTRIES = SOFT_SKILLS.map((skill) => ({
  skill,
  lowerSkill: skill.toLowerCase(),
}));

function skillPresent(text: string, skill: string, lowerText: string, lowerSkill: string): boolean {
  const precheck = SKILL_GATE_PRECHECK[skill];
  if (precheck && !precheck.some((kw) => lowerText.includes(kw))) {
    return false;
  }
  const gate = SKILL_CONTEXT[skill];
  if (gate) return gate(text, lowerText);
  return matchesTerm(text, skill, lowerText, lowerSkill);
}

/**
 * Extracts hard and soft skills present in the given text.
 * Performance optimization: Pre-computes lowercased text and passes pre-lowercased
 * skill tokens to `matchesTerm` to bypass regex execution when keywords are absent.
 */
export function extractSkills(text: string): { hard: string[]; soft: string[] } {
  const lowerText = text.toLowerCase();
  const hard = HARD_SKILLS_ENTRIES.filter(({ skill, lowerSkill }) =>
    skillPresent(text, skill, lowerText, lowerSkill)
  ).map(({ skill }) => skill);

  const soft = SOFT_SKILLS_ENTRIES.filter(({ skill, lowerSkill }) =>
    matchesTerm(text, skill, lowerText, lowerSkill)
  ).map(({ skill }) => skill);

  return { hard: [...new Set(hard)], soft: [...new Set(soft)] };
}
