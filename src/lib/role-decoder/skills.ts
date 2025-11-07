export type SkillDictionaryEntry = {
  id: string;
  label: string;
  keywords: string[];
};

export type SkillDictionary = Record<string, SkillDictionaryEntry>;

export type DetectedSkill = {
  key: string;
  id: string;
  label: string;
  matches: string[];
  frequency: number;
  confidence: number;
};

function normalize(text: string) {
  return text.toLowerCase();
}

export function detectSkills(text: string, dictionary: SkillDictionary): DetectedSkill[] {
  const normalized = normalize(text);
  const detections: DetectedSkill[] = [];

  for (const [key, entry] of Object.entries(dictionary)) {
    const matches = entry.keywords
      .map((keyword) => keyword.trim())
      .filter(Boolean)
      .flatMap((keyword) => {
        const occurrences = countOccurrences(normalized, keyword.toLowerCase());
        return occurrences.map(() => keyword);
      });

    if (matches.length === 0) continue;

    const uniqueMatches = new Set(matches.map((match) => match.toLowerCase()));
    const confidence = Math.min(1, uniqueMatches.size / Math.max(1, entry.keywords.length / 2));

    detections.push({
      key,
      id: entry.id,
      label: entry.label,
      matches,
      frequency: matches.length,
      confidence,
    });
  }

  return detections.sort((a, b) => {
    if (b.frequency !== a.frequency) return b.frequency - a.frequency;
    return b.confidence - a.confidence;
  });
}

function countOccurrences(text: string, keyword: string) {
  if (!keyword) return [] as number[];
  const indices: number[] = [];
  let startIndex = 0;
  while (startIndex < text.length) {
    const index = text.indexOf(keyword, startIndex);
    if (index === -1) break;
    indices.push(index);
    startIndex = index + keyword.length;
  }
  return indices;
}
