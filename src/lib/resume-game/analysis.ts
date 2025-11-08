import { POWER_VERB_PATTERN, POWER_WORDS } from './constants';
import { scoreBullet } from './scoring';
import { capitalizeWord, escapeRegExp, normalizeLine, normalizeTextLine, uniqueId } from './text';
import type { BulletFields, BulletRecord } from './types';

export function extractBullets(text: string): string[] {
  const preferred = text.match(/^[-•*]\s+.+$/gm);
  const source = preferred && preferred.length > 0 ? preferred : text.split('\n');
  return source.map((line) => normalizeTextLine(line)).filter(Boolean);
}

export function seedFields(text: string): BulletFields {
  const cleaned = normalizeLine(text);
  const verbMatch = cleaned.match(new RegExp(`^(${POWER_WORDS.map(escapeRegExp).join('|')})\\b`, 'i'))
    || cleaned.match(new RegExp(`\\b(${POWER_WORDS.map(escapeRegExp).join('|')})\\b`, 'i'));
  const verb = verbMatch ? verbMatch[1] : '';
  const remainder = verb ? cleaned.replace(new RegExp(`\\b${escapeRegExp(verb)}\\b`, 'i'), '').trim() : cleaned;
  let task = remainder;
  let impact = '';

  const byIndex = remainder.toLowerCase().indexOf(' by ');
  const toIndex = remainder.toLowerCase().indexOf(' to ');
  const splitIndex = byIndex >= 0 ? byIndex : toIndex;
  if (splitIndex >= 0) {
    task = remainder.slice(0, splitIndex).trim();
    impact = remainder.slice(splitIndex).trim();
  }

  const quantifier = cleaned.match(/\d+\.?\d*%?/g)?.[0] ?? '';

  return {
    verb: capitalizeWord(verb),
    task: task.trim(),
    impact,
    quantifier,
  };
}

export function buildBullet(fields: BulletFields) {
  const parts: string[] = [];
  if (fields.verb) parts.push(capitalizeWord(fields.verb));
  if (fields.task) parts.push(fields.task.trim());
  let statement = parts.join(' ');
  if (fields.impact) {
    const normalized = fields.impact.trim();
    const needsConnector = !normalized.toLowerCase().startsWith('to') && !normalized.toLowerCase().startsWith('by');
    statement += needsConnector ? ` to ${normalized}` : ` ${normalized}`;
  }
  if (fields.quantifier) {
    statement += statement.includes(fields.quantifier) ? '' : ` (${fields.quantifier.trim()})`;
  }
  let out = `• ${statement.replace(/\s+/g, ' ').trim()}`;
  if (!/[.!?]$/.test(out)) out += '.';
  return out;
}

export function fieldBonus(fields: BulletFields) {
  let bonus = 0;
  if (fields.verb.trim()) bonus += 5;
  if (fields.quantifier.trim()) bonus += 5;
  if (fields.impact.trim()) bonus += 5;
  return bonus;
}

export function editBonus(original: string, fields: BulletFields) {
  const normalized = normalizeLine(original);
  const startsWithVerb = new RegExp(`^(${POWER_WORDS.map(escapeRegExp).join('|')})\b`, 'i').test(normalized);
  const hasAnyVerb = POWER_VERB_PATTERN.test(normalized);
  let bonus = 0;
  if (!startsWithVerb && fields.verb.trim()) bonus += 4;
  if (fields.quantifier.trim() && !/(\$?\d+[\d,]*\.?\d*%?)/.test(normalized)) bonus += 4;
  if (fields.impact.trim() && !/(\bby\b|\bto\b)/.test(normalized)) bonus += 3;
  const rebuilt = normalizeLine(buildBullet(fields));
  if (rebuilt !== normalized) bonus += 2;
  if (!hasAnyVerb && fields.verb.trim()) bonus += 2;
  return bonus;
}

export function createBulletRecord(line: string, index: number): BulletRecord {
  const sanitized = line.replace(/\s+/g, ' ').trim();
  const fields = seedFields(sanitized);
  const improved = buildBullet(fields);
  const bonus = fieldBonus(fields) + editBonus(sanitized, fields);
  return {
    id: uniqueId('bullet', index),
    original: sanitized.replace(/^[-•*]\s*/, ''),
    fields,
    baselineScore: scoreBullet(sanitized),
    improved,
    improvedScore: scoreBullet(improved) + bonus,
  };
}
