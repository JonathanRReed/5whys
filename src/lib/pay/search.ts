import type { OccupationCrosswalk, TitleCandidate, TitleIndex, TitleMatchKind } from './types';

export function normalizeTitle(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\+/g, ' plus ')
    .replace(/#/g, ' sharp ')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// One insertion, deletion, substitution, or adjacent transposition per query token.
function near(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 4 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    return (
      a.slice(i + 1) === b.slice(i + 1) ||
      (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2))
    );
  }
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/** Words a title can leave out without changing the job: "Director of Operations". */
const FILLER = new Set(['of', 'and', 'the', 'for', 'a', 'an', 'in', 'at', 'to', 'with']);

/** Military occupations share many words with civilian ones ("operations", "command"). */
const MILITARY = /^55-/;
const MILITARY_WORDS =
  /\b(military|army|navy|naval|marine|marines|air force|coast guard|national guard|enlisted|officer|tactical|infantry|artillery|combat)\b/;

export function createTitleSearch(index: TitleIndex, crosswalk: OccupationCrosswalk = {}) {
  const rows = index.titles.map(([title, occupationIndex, sources]) => {
    const normalized = normalizeTitle(title);
    return { title, occupationIndex, sources, normalized, tokens: normalized.split(' ') };
  });
  return (query: string, limit = 12): TitleCandidate[] => {
    const normalized = normalizeTitle(query.slice(0, 200));
    if (!normalized || !Number.isFinite(limit) || limit < 1) return [];
    const words = normalized.split(' ');
    const meaningful = words.filter((word) => !FILLER.has(word));
    const tokens = meaningful.length > 0 ? meaningful : words;
    // A civilian title should not lead with a military occupation.
    const militaryQuery = MILITARY_WORDS.test(normalized);
    const best = new Map<number, { candidate: TitleCandidate; rank: number; extra: number }>();
    for (const row of rows) {
      let rank: number;
      let match: TitleMatchKind;
      if (row.normalized === normalized) {
        match = row.sources & 1 ? 'official' : row.sources & 2 ? 'alternate' : 'reported';
        rank = match === 'official' ? 0 : match === 'alternate' ? 1 : 2;
      } else if (tokens.every((token) => row.tokens.some((word) => word.startsWith(token)))) {
        match = 'token';
        rank = 3;
      } else if (tokens.every((token) => row.tokens.some((word) => near(token, word)))) {
        match = 'fuzzy';
        rank = 4;
      } else if (
        // "Fulfillment Director": every word but one, when the one that
        // matched is a real word, finds the Director titles. Shown last.
        tokens.length > 1 &&
        tokens.filter((token) => row.tokens.some((word) => word.startsWith(token))).length ===
          tokens.length - 1 &&
        tokens.some((token) => token.length >= 4 && row.tokens.includes(token))
      ) {
        match = 'fuzzy';
        rank = 6;
      } else continue;
      const occupation = index.occupations[row.occupationIndex];
      if (!occupation) continue;
      if (rank > 0 && !militaryQuery && MILITARY.test(occupation.onetCode)) rank += 0.5;
      const extra = row.normalized.length - normalized.length;
      const previous = best.get(row.occupationIndex);
      if (previous && (previous.rank < rank || (previous.rank === rank && previous.extra <= extra)))
        continue;
      const mapping = crosswalk[occupation.onetCode] ?? null;
      best.set(row.occupationIndex, {
        rank,
        extra,
        candidate: {
          ...occupation,
          occupationCode: mapping?.occupationCode ?? null,
          matchedTitle: row.title,
          match,
          label: `${occupation.title} (${occupation.onetCode})`,
          mapping,
        },
      });
    }
    const found = [...best.values()];
    // Partial matches only when nothing matched every word.
    const strongest = found.some((entry) => entry.rank < 6)
      ? found.filter((e) => e.rank < 6)
      : found;
    return strongest
      .sort(
        (a, b) =>
          a.rank - b.rank ||
          a.extra - b.extra ||
          a.candidate.title.localeCompare(b.candidate.title) ||
          a.candidate.onetCode.localeCompare(b.candidate.onetCode)
      )
      .slice(0, Math.min(50, Math.floor(limit)))
      .map(({ candidate }) => candidate);
  };
}
