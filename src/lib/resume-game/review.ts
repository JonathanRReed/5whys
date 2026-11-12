import { summarizeLines, summarySentences } from './analysis';
import { PART_LABELS, scoreBullet, scoreParts } from './scoring';
import type { BulletRecord } from './types';

/** File name stem for the downloaded review. It says review, never resume. */
export const REVIEW_FILE_BASE = 'resume-game-review';

const comparable = (text: string) =>
  text
    .replace(/^[-•*]\s*/, '')
    .replace(/[.!?]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * A plain-text review of the scored lines, for Markdown and Word downloads.
 * It is a report about the resume, not a resume, and it says so first.
 */
export function buildReviewReport(bullets: BulletRecord[], date: string): string {
  const lines = bullets.map((bullet) => bullet.improved || bullet.original);
  const summary = summarySentences(summarizeLines(lines));
  const out: string[] = [
    '# Resume Game review',
    '',
    `Made ${date}. This is a review of the lines in your resume, not a resume. Each line is scored out of 100 for four parts: ${PART_LABELS.action.toLowerCase()} (20), ${PART_LABELS.work.toLowerCase()} (25), ${PART_LABELS.result.toLowerCase()} (40), and ${PART_LABELS.measure.toLowerCase()} (15).`,
    '',
    '## Where the lines stand',
    ...summary.map((sentence) => `- ${sentence}`),
    '',
    '## Each line',
  ];
  bullets.forEach((bullet, index) => {
    const rewritten = bullet.edited && comparable(bullet.improved) !== comparable(bullet.original);
    const text = rewritten ? bullet.improved : bullet.original;
    const parts = scoreParts(text);
    out.push('', `### Line ${index + 1}`, '', `As written: ${bullet.original}`);
    if (rewritten) out.push(`Your rewrite: ${bullet.improved}`);
    out.push(`Score: ${scoreBullet(text)} of 100${rewritten ? ', for your rewrite' : ''}.`);
    for (const key of ['action', 'work', 'result', 'measure'] as const) {
      const part = parts[key];
      out.push(`- ${PART_LABELS[key]}: ${part.points} of ${part.max}. ${part.note}`);
    }
  });
  out.push('');
  return out.join('\n');
}
