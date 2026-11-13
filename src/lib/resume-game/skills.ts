import { HARD_SKILLS, matchesTerm, SOFT_SKILLS, WORK_METHODS } from './constants';
import { escapeRegExp } from './text';

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

// Where a soft skill names a team or a department, not something the visitor
// can do: "Worked closely with drivers and customer service". Those mentions
// are set aside before the skill is looked for.
const NOT_A_SKILL: Record<string, RegExp> = {
  'customer service':
    // Named as a department, or as one of the teams worked with. "Provided
    // sales and customer service" and a skills list are the visitor's own.
    /\b(?:with|between|alongside)\s+(?:the\s+)?(?:[\w&-]+\s+){0,3}?(?:and|&)\s+(?:the\s+)?customer service\b(?!\s+(?:skills?|experience))|\b(?:with|from|alongside)\s+(?:the\s+)?customer service\b(?!\s+(?:skills?|experience))|\bto\s+the\s+customer service\b|\bcustomer service\s+(?:team|department|desk|reps?|representatives?|staff|managers?|center|line)\b/gi,
};

/**
 * The skill as the resume writes it: "Excel", "SQL", "S&OP". Skills are
 * stored lowercase so they can be matched; this is how they are shown.
 */
export function skillAsWritten(text: string, skill: string): string {
  const match = text.match(
    new RegExp(`(?:^|[^a-z0-9])(${escapeRegExp(skill)})(?:$|[^a-z0-9])`, 'i')
  );
  const found = match?.[1];
  if (!found) return skill;
  // A word written all in lowercase in the resume still reads as a name here.
  return found === found.toLowerCase() && !/\s/.test(found) && found.length <= 4
    ? found.toUpperCase()
    : found;
}

// Pre-computed lowercased skill entries to avoid string allocation on every extractSkills execution.
const HARD_SKILLS_ENTRIES = [...HARD_SKILLS, ...WORK_METHODS].map((skill) => ({
  skill,
  lowerSkill: skill.toLowerCase(),
}));

const SOFT_SKILLS_ENTRIES = SOFT_SKILLS.map((skill) => ({
  skill,
  lowerSkill: skill.toLowerCase(),
}));

function skillPresent(text: string, skill: string, lowerText: string, lowerSkill: string): boolean {
  const gate = SKILL_CONTEXT[skill];
  if (gate) return gate.test(text);
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

  const soft = SOFT_SKILLS_ENTRIES.filter(({ skill, lowerSkill }) => {
    const aside = NOT_A_SKILL[skill];
    const rest = aside ? text.replace(aside, ' ') : text;
    return matchesTerm(rest, skill, aside ? rest.toLowerCase() : lowerText, lowerSkill);
  }).map(({ skill }) => skill);

  // A shorter name inside a longer one ("WMS" in "Manhattan WMS") is one skill.
  const unique = [...new Set(hard)];
  const distinct = unique.filter(
    (skill) =>
      !unique.some(
        (other) => other !== skill && new RegExp(`\\b${escapeRegExp(skill)}\\b`).test(other)
      )
  );
  return { hard: distinct, soft: [...new Set(soft)] };
}
