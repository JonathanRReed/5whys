import { looksLikeHeading, readDocument } from '../posting/resume-lines';

/** Patterns tested against heading lines only, so "Helped with projects" is not a Projects section. */
const SECTION_PATTERNS: Record<string, RegExp> = {
  summary: /\b(summary|objective|profile|about me|highlights)\b/i,
  experience: /\b(experience|employment|work history|career history|internships?)\b/i,
  education: /\b(education|academic|degrees?|coursework)\b/i,
  skills: /\b(skills|proficiencies|competencies|expertise|tools|technologies)\b/i,
  projects: /\b(projects|portfolio)\b/i,
  certifications: /\b(certifications?|licenses?|credentials|certificates)\b/i,
  awards: /\b(awards|honors|achievements|recognition)\b/i,
  publications: /\b(publications|papers|research|patents)\b/i,
  languages: /^\s*languages\b/i,
  volunteering: /\b(volunteer(ing)?|community service)\b/i,
  activities: /\b(activities|leadership|involvement|extracurriculars?)\b/i,
  interests: /\b(interests|hobbies)\b/i,
};

const GLYPH_LINE = /^\s*[-•*◦○●▪–—]\s/;

/** The sections a resume names in its own heading lines. */
export function detectSections(text: string): string[] {
  const headings = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !GLYPH_LINE.test(line) && looksLikeHeading(line));
  const found: string[] = [];
  for (const [section, pattern] of Object.entries(SECTION_PATTERNS)) {
    if (headings.some((heading) => pattern.test(heading))) found.push(section);
  }
  return found;
}

/** Dated roles spanning this many years or more read as a long career. */
const LONG_CAREER_YEARS = 10;

/** True when the dated roles run from first start to last end over many years. */
function isLongCareer(text: string): boolean {
  const roles = readDocument(text).roles;
  if (roles.length === 0) return false;
  const months = (stamp: { year: number; month: number }) => stamp.year * 12 + stamp.month;
  const first = Math.min(...roles.map((role) => months(role.from)));
  const last = Math.max(...roles.map((role) => months(role.to)));
  return last - first >= LONG_CAREER_YEARS * 12;
}

/** Words on one full page of resume text. */
export const WORDS_PER_PAGE = 500;

export function analyzeResumeLength(text: string, extractedBulletCount = 0) {
  const words = text.split(/\s+/).filter(Boolean).length;
  const lines = text.split('\n').length;
  // Glyph counting misses pasted text without bullet characters, which is
  // common after PDF extraction. Fall back to the count of bullets the
  // analyzer actually extracted so the report never claims 0 bullets while
  // listing them below.
  const glyphBullets = (text.match(/^[-•*◦○●]\s+/gm) || []).length;
  const bullets = glyphBullets > 0 ? glyphBullets : extractedBulletCount;

  // A full page of resume text at a normal size and margin holds about this
  // many words. It is an estimate from the word count, not a measurement.
  const estimatedPages = Math.max(1, Math.round(words / WORDS_PER_PAGE));

  const sections = detectSections(text);

  const longCareer = isLongCareer(text);
  let recommendation: string;
  if (estimatedPages > 2) {
    recommendation = 'Likely longer than two pages. Keep your strongest lines and cut the rest.';
  } else if (words < 200) {
    recommendation = longCareer
      ? 'Short resume. There is room to say what you did in each role and what came of it.'
      : 'Short resume. Projects, coursework, campus jobs, and volunteering all count as experience worth listing.';
  } else if (estimatedPages === 2) {
    recommendation = longCareer
      ? 'Likely about two pages, common once you have many years of work to show.'
      : 'Likely about two pages. One page is the norm for a student or a first job. Two is common once you have many years of work to show.';
  } else {
    recommendation = longCareer
      ? 'Likely about one page. One or two pages both work once you have many years of work to show.'
      : 'Likely about one page, the usual length when you are starting out.';
  }

  const isOptimalLength = estimatedPages <= 2 && words >= 200;

  return {
    wordCount: words,
    lineCount: lines,
    bulletCount: bullets,
    estimatedPages,
    sections,
    sectionCount: sections.length,
    isOptimalLength,
    recommendation,
  };
}
