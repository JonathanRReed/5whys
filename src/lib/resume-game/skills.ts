import { HARD_SKILLS, matchesTerm, SOFT_SKILLS } from './constants';

/**
 * Skill detection with context gates. Short or common-word skill names only
 * count with supporting context, so "Spring 2024" is a semester, "R" in
 * "R. Smith" is an initial, and "go" is a verb unless it sits in a language
 * list. Everything else matches on word boundaries as before.
 */
const SKILL_CONTEXT: Record<string, RegExp> = {
  spring: /spring\s*(boot|framework|mvc|cloud|security|data)\b/i,
  go: /\bgolang\b|\bgo\s*(?:lang|programming|routines?)\b|\b(?:python|java|rust|typescript|javascript|c\+\+|c#|kotlin|swift|ruby|r|scala)\s*(?:,|\/|and|&)\s*go\b(?=\s*(?:,|\/|;|\.|and|&|$))|\bgo\s*(?:,|\/)\s*(?:python|java|rust|typescript|javascript|c\+\+|c#|kotlin|swift|ruby|r|scala)\b/i,
  r: /\br\s*(?:studio|programming|language|markdown|shiny)\b|\brstudio\b|\b(?:python|sas|spss|stata|matlab|sql|excel|go|java|julia)\s*(?:,|\/|and|&)\s*r\b(?=\s*(?:,|\/|;|\.|and|&|$))|\br\s*(?:,|\/)\s*(?:python|sas|spss|stata|matlab|sql|excel|go|java|julia)\b|\bin r\b(?=\s*(?:,|\.|;|$|and|for|to))|\busing r\b/i,
  express:
    /express\.?js\b|\bexpress\s*(?:framework|server|api|app|router)\b|\bnode(?:\.js)?\s*(?:\/|,|and|\+|&)\s*express\b/i,
  chef: /\bchef\b(?=[\s\S]*\b(?:cookbook|recipe|ansible|puppet|terraform|infrastructure|devops|automation|provision)\b)/i,
  shell: /shell\s*(?:script|scripting|commands?)\b|\bbash\b|\bzsh\b|\bunix shell\b/i,
  oracle: /oracle\s*(?:database|db|sql|cloud|erp|apex|fusion|netsuite|11g|12c|19c)\b|\bpl\/sql\b/i,
  unity:
    /unity\s*(?:3d|engine|game|editor|project|scripts?)\b|\bunity3d\b|\bc#\b[\s\S]*\bunity\b|\bunity\b[\s\S]*\bc#\b/i,
  sas: /\bsas\s*(?:studio|enterprise|programming|base|viya)\b|\bsas\b(?=[\s\S]*\b(?:statistic|statistical|data analysis|analytics|spss|stata|regression)\b)/i,
  lean: /\blean\s*(?:manufacturing|six sigma|methodology|principles|startup|process|management)\b|\bsix sigma\b/i,
  sketch: /\bsketch\b(?=[\s\S]*\b(?:figma|design|prototype|wireframe|ui|ux|invision|zeplin)\b)/i,
  notion:
    /\bnotion\.so\b|\bnotion\b(?=[\s\S]*\b(?:workspace|wiki|database|template|jira|confluence|asana|trello|docs)\b)/i,
  lambda: /\baws lambda\b|\blambda\s*functions?\b|\bserverless\b[\s\S]*\blambda\b/i,
  sem: /\bsem\b(?=[\s\S]*\b(?:seo|ppc|google ads|adwords|paid search|search marketing|campaigns?)\b)/i,
  premiere: /premiere\s*pro\b|\badobe premiere\b/i,
  git: /\bgit\b(?!hub|lab)/i,
  documentation:
    /\b(?:wrote|write|writing|maintained|authored|created|technical)\s+documentation\b|\bdocumentation\s+(?:for|of|site)\b/i,
};

function skillPresent(text: string, skill: string): boolean {
  const gate = SKILL_CONTEXT[skill];
  if (gate) return gate.test(text);
  return matchesTerm(text, skill);
}

export function extractSkills(text: string): { hard: string[]; soft: string[] } {
  const hard = HARD_SKILLS.filter((skill) => skillPresent(text, skill));
  const soft = SOFT_SKILLS.filter((skill) => matchesTerm(text, skill));
  return { hard: [...new Set(hard)], soft: [...new Set(soft)] };
}
