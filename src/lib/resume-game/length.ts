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

export function analyzeResumeLength(text: string) {
  const words = text.split(/\s+/).filter(Boolean).length;
  const lines = text.split('\n').length;
  const bullets = (text.match(/^[-•*\u25E6\u25CB\u25CF]\s+/gm) || []).length;

  // Estimate pages at ~250 words per page (standard resume density)
  const estimatedPages = Math.max(1, Math.round(words / 250));

  const sections = detectSections(text);

  let recommendation: string;
  if (estimatedPages > 2) {
    recommendation = 'Consider trimming to 1-2 pages for better recruiter engagement.';
  } else if (words < 200) {
    recommendation = 'Resume is quite short. Add more detail to your experience section.';
  } else if (words > 800) {
    recommendation = 'Resume is getting long. Prioritize your strongest bullets.';
  } else {
    recommendation = 'Good length for most roles.';
  }

  const isOptimalLength = estimatedPages <= 2 && words >= 200 && words <= 800;

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
