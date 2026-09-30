import * as React from 'react';
import { POWER_VERB_GLOBAL_PATTERN } from './constants';

const REGEX_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g;
const HEADINGS = new Set([
  'summary',
  'education',
  'experience',
  'skills',
  'contact',
  'interests',
  'projects',
]);
const MONTHS =
  '(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)';
const DATE_RANGE_PATTERN = new RegExp(
  `^(${MONTHS}\\s+\\d{4}|\\d{4})(\\s*[–-]\\s*(${MONTHS}\\s+\\d{4}|\\d{4}|current))?$`,
  'i'
);

export function escapeRegExp(value: string) {
  return value.replace(REGEX_SPECIAL_CHARS, '\\$&');
}

export function decodeEntities(text: string) {
  if (!text) return '';
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function capitalizeWord(value: string) {
  if (!value) return '';
  return value.slice(0, 1).toUpperCase() + value.slice(1).toLowerCase();
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizeLine(raw: string) {
  const decoded = decodeEntities(raw)
    .replace(/^[-•*]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!decoded) return '';
  const heading = decoded.toLowerCase();
  if (HEADINGS.has(heading)) return '';
  if (DATE_RANGE_PATTERN.test(decoded)) return '';
  if (decoded.replace(/[^a-zA-Z0-9]/g, '').length < 3) return '';
  return decoded;
}

export function highlightResume(text: string) {
  if (!text) return '';
  const escaped = escapeHtml(decodeEntities(text));
  return escaped
    .replace(
      /\d+\.?\d*%?/g,
      '<mark class="bg-primary/30 text-primary-foreground px-1 rounded">$&</mark>'
    )
    .replace(
      POWER_VERB_GLOBAL_PATTERN,
      '<mark class="bg-love/30 text-foreground px-1 rounded">$&</mark>'
    );
}

export function countPowerVerbs(text: string) {
  if (!text) return 0;
  const matches = decodeEntities(text).match(POWER_VERB_GLOBAL_PATTERN);
  return matches ? matches.length : 0;
}

export function uniqueId(prefix: string, index: number) {
  return `${prefix}-${index}-${Math.random().toString(36).slice(2, 7)}`;
}

export function highlightResumeToNodes(text: string): React.ReactNode[] {
  if (!text) return [];
  const decoded = decodeEntities(text);
  const lines = decoded.split('\n');
  const result: React.ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) {
      result.push(React.createElement('br', { key: `br-${lineIdx}` }));
    }

    const matches: Array<{ start: number; end: number; type: 'number' | 'verb'; text: string }> =
      [];

    const numberRegex = /\d+\.?\d*%?/g;
    let match = numberRegex.exec(line);
    while (match !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        type: 'number',
        text: match[0],
      });
      match = numberRegex.exec(line);
    }

    const verbRegex = new RegExp(POWER_VERB_GLOBAL_PATTERN.source, 'gi');
    let vMatch = verbRegex.exec(line);
    while (vMatch !== null) {
      matches.push({
        start: vMatch.index,
        end: vMatch.index + vMatch[0].length,
        type: 'verb',
        text: vMatch[0],
      });
      vMatch = verbRegex.exec(line);
    }

    matches.sort((a, b) => a.start - b.start);
    const filteredMatches: typeof matches = [];
    let lastEnd = 0;
    for (const match of matches) {
      if (match.start >= lastEnd) {
        filteredMatches.push(match);
        lastEnd = match.end;
      }
    }

    let cursor = 0;
    filteredMatches.forEach((match, idx) => {
      if (match.start > cursor) {
        result.push(line.slice(cursor, match.start));
      }
      if (match.type === 'number') {
        result.push(
          React.createElement(
            'mark',
            {
              key: `l${lineIdx}-m${idx}`,
              className: 'bg-primary/30 text-primary-foreground px-1 rounded',
            },
            match.text
          )
        );
      } else {
        result.push(
          React.createElement(
            'mark',
            { key: `l${lineIdx}-m${idx}`, className: 'bg-love/30 text-foreground px-1 rounded' },
            match.text
          )
        );
      }
      cursor = match.end;
    });

    if (cursor < line.length) {
      result.push(line.slice(cursor));
    }
  });

  return result;
}
