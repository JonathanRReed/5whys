export type SectionKey =
  | 'purpose'
  | 'responsibilities'
  | 'qualifications'
  | 'requirements'
  | 'skills'
  | 'general';

export type ParsedSection = {
  key: SectionKey;
  heading: string;
  lines: string[];
};

export type ParsedJobPost = {
  sections: ParsedSection[];
  text: string;
};

type SectionPattern = {
  key: SectionKey;
  labels: string[];
};

const SECTION_PATTERNS: SectionPattern[] = [
  { key: 'purpose', labels: ['overview', 'summary', 'about the role', 'mission', 'job purpose'] },
  {
    key: 'responsibilities',
    labels: ['responsibilities', 'what you will do', 'day to day', 'key duties', 'role description'],
  },
  {
    key: 'qualifications',
    labels: ['qualifications', 'what you bring', 'must have', 'basic qualifications', 'preferred qualifications'],
  },
  {
    key: 'requirements',
    labels: ['requirements', 'skill requirements', 'requirements & skills', 'experience'],
  },
  { key: 'skills', labels: ['skills', 'core skills', 'technical skills'] },
];

const DEFAULT_SECTION: ParsedSection = { key: 'general', heading: 'General', lines: [] };

const CLEAN_HEADER_REGEX = /^[-•*\d.)\s]+/;

function matchSection(line: string): SectionPattern | null {
  const normalized = line.toLowerCase().trim().replace(CLEAN_HEADER_REGEX, '');
  return SECTION_PATTERNS.find((pattern) =>
    pattern.labels.some((label) => normalized.startsWith(label))
  ) ?? null;
}

function finalizeSection(section: ParsedSection | null, results: ParsedSection[]) {
  if (section && section.lines.length > 0) {
    section.lines = section.lines.map((line) => line.trim()).filter(Boolean);
    results.push(section);
  }
}

export function parseSections(input: string): ParsedJobPost {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const sections: ParsedSection[] = [];
  let current: ParsedSection | null = { ...DEFAULT_SECTION };

  for (const rawLine of lines) {
    const sectionPattern = matchSection(rawLine);
    if (sectionPattern) {
      finalizeSection(current, sections);
      current = {
        key: sectionPattern.key,
        heading: formatHeading(rawLine, sectionPattern.labels[0]),
        lines: [],
      };
      continue;
    }

    if (!current) {
      current = { ...DEFAULT_SECTION };
    }

    current.lines.push(rawLine);
  }

  finalizeSection(current, sections);

  if (sections.length === 0) {
    sections.push({ ...DEFAULT_SECTION, lines: lines });
  }

  return { sections, text: input };
}

function formatHeading(rawLine: string, fallbackLabel: string) {
  const cleaned = rawLine.replace(CLEAN_HEADER_REGEX, '').trim();
  if (!cleaned) return capitalize(fallbackLabel);
  return capitalize(cleaned.replace(/:$/, ''));
}

function capitalize(value: string) {
  if (!value) return value;
  return value
    .split(/\s+/)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}
