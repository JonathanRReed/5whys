const SECTION_PATTERNS: Record<string, RegExp> = {
  summary: /\b(summary|objective|profile|about me)\b/i,
  experience: /\b(experience|employment|work history|professional experience|career history)\b/i,
  education: /\b(education|academic|degree|university|college|school)\b/i,
  skills: /\b(skills|technical skills|proficiencies|competencies|tools|technologies)\b/i,
  projects: /\b(projects|portfolio|side projects|open source)\b/i,
  certifications: /\b(certifications|licenses|credentials|certificates)\b/i,
  awards: /\b(awards|honors|achievements|recognition)\b/i,
  publications: /\b(publications|papers|research|patents)\b/i,
  languages: /\b(languages|fluent in|bilingual|multilingual)\b/i,
  interests: /\b(interests|hobbies|activities|volunteer)\b/i,
};

export function detectSections(text: string): string[] {
  const found: string[] = [];
  for (const [section, pattern] of Object.entries(SECTION_PATTERNS)) {
    if (pattern.test(text)) found.push(section);
  }
  return found;
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

  let recommendation: string;
  if (estimatedPages > 2) {
    recommendation = 'Longer than two pages. Keep your strongest lines and cut the rest.';
  } else if (words < 200) {
    recommendation =
      'Short resume. Projects, coursework, campus jobs, and volunteering all count as experience worth listing.';
  } else if (estimatedPages === 2) {
    recommendation =
      'About two pages. One page is the norm for a student or a first job. Two is common once you have many years of work to show.';
  } else {
    recommendation = 'About one page, the usual length when you are starting out.';
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
