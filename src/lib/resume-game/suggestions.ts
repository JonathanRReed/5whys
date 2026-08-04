import type { BulletRecord } from './types';
import { BUZZWORDS, getVerbStrength, matchesTerm, suggestStrongerVerb } from './constants';
import { analyzeReadability } from './readability';
import { normalizeLine } from './text';

export type BulletSuggestion = {
  type:
    | 'missing-verb'
    | 'weak-verb'
    | 'buzzword'
    | 'missing-number'
    | 'scope-alternatives'
    | 'missing-impact'
    | 'too-long'
    | 'passive-voice'
    | 'too-short'
    | 'readability';
  message: string;
  fix?: string;
  studentExample?: string;
  professionalExample?: string;
};

/**
 * Context-sensitive verb suggestions: read what the bullet is about and
 * offer verbs that fit that kind of work instead of a generic trio.
 */
function suggestVerbsFor(text: string): string {
  const lower = text.toLowerCase();
  if (/(research|lab|data|survey|analysis|thesis|experiment)/.test(lower)) {
    return 'Researched, Analyzed, Presented';
  }
  if (/(club|event|meeting|volunteer|fundrais|chapter|committee)/.test(lower)) {
    return 'Organized, Coordinated, Recruited';
  }
  if (/(code|app|website|software|script|prototype|bug)/.test(lower)) {
    return 'Built, Programmed, Automated';
  }
  if (/(tutor|teach|train|mentor|grading|course)/.test(lower)) {
    return 'Taught, Tutored, Mentored';
  }
  if (/(customer|cash|store|shift|inventory|front desk)/.test(lower)) {
    return 'Operated, Resolved, Trained';
  }
  return 'Led, Built, Organized, Analyzed';
}

/**
 * A metric prompt that reads the bullet and asks for the number most likely
 * to exist for that kind of work.
 */
function metricPromptFor(text: string): string {
  const lower = text.toLowerCase();
  if (/(team|group|club|committee|volunteers)/.test(lower)) {
    return 'How many people? How often did you meet or ship?';
  }
  if (/(event|meeting|workshop|session|game|performance)/.test(lower)) {
    return 'How many events? How many attendees?';
  }
  if (/(customer|client|patient|student|user)/.test(lower)) {
    return 'How many per shift, per week, or per semester?';
  }
  if (/(code|app|report|dashboard|script|process)/.test(lower)) {
    return 'How many users, hours saved, or steps removed?';
  }
  return 'Count something real: people, hours, items, dollars, or frequency.';
}

export function generateBulletSuggestions(bullet: BulletRecord): BulletSuggestion[] {
  const suggestions: BulletSuggestion[] = [];
  const { fields } = bullet;
  // Analyze the current state of the bullet, so suggestions clear as the
  // user fills in fields instead of nagging about the original forever.
  const current = normalizeLine(bullet.improved) || normalizeLine(bullet.original);
  const readability = analyzeReadability(current);
  const firstWord = current.split(/\s+/)[0] ?? '';

  // Missing verb
  if (!fields.verb.trim()) {
    suggestions.push({
      type: 'missing-verb',
      message: firstWord
        ? `This line starts with "${firstWord}" instead of an action verb.`
        : 'This line has no action verb.',
      fix: `Try: ${suggestVerbsFor(current)}.`,
      studentExample:
        'Organized a 3-day club fundraiser with 12 volunteers, raising $1,400 for the local food bank.',
      professionalExample:
        'Led the migration of 40 client accounts to a new billing system with zero missed invoices.',
    });
  }

  // Weak verb
  if (fields.verb.trim() && getVerbStrength(fields.verb) === 'weak') {
    const stronger = suggestStrongerVerb(fields.verb);
    suggestions.push({
      type: 'weak-verb',
      message: `"${fields.verb}" describes involvement, not contribution. Name what you actually did.`,
      fix: stronger
        ? `Try "${stronger}", or the verb you would use telling a friend about it.`
        : 'Use the verb you would use telling a friend what you did.',
      studentExample:
        '"Helped with lab experiments" becomes "Prepared 30+ agar plates weekly and logged results for a microbiology study."',
      professionalExample:
        '"Assisted with onboarding" becomes "Built the onboarding checklist now used for every new hire."',
    });
  }

  // Buzzwords: traits claimed instead of shown
  const buzzword = BUZZWORDS.find((b) => matchesTerm(current, b));
  if (buzzword) {
    suggestions.push({
      type: 'buzzword',
      message: `"${buzzword}" is a claim anyone can make. Cut it and show the work that proves it.`,
      studentExample:
        '"Detail-oriented team player" becomes "Caught and fixed 3 gradebook errors before final grades posted."',
      professionalExample:
        '"Results-driven leader" becomes "Took over a stalled migration and shipped it in 6 weeks."',
    });
  }

  // Missing quantifier
  const hasNumber = /\$?\d/.test(current) || /\d/.test(fields.quantifier);
  if (!hasNumber) {
    suggestions.push({
      type: 'missing-number',
      message: 'No number yet. One concrete figure makes this line easier to trust.',
      fix: metricPromptFor(current),
      studentExample:
        'Graded weekly problem sets for a 90-student linear algebra course and held 2 office hours per week.',
      professionalExample:
        'Cut invoice processing from 4 days to 1 by batching approvals across 3 departments.',
    });
    suggestions.push({
      type: 'scope-alternatives',
      message:
        'No metric to cite? Use concrete scope instead. Team size, frequency, audience, and before/after states are all evidence.',
      fix: 'Name who was affected, how often it happened, or what it looked like before versus after.',
      studentExample:
        'Ran sound for every home basketball game across two seasons, handling setup and teardown solo.',
      professionalExample:
        'Became the go-to reviewer for release notes, turning a two-owner bottleneck into a same-day review.',
    });
  }

  // Missing impact
  if (!fields.impact.trim() && !/(\bby\b|\bto\b|\bresult(ing)? in\b|\bleading to\b)/i.test(current)) {
    const changeWord = current.match(
      /\b(improved|reduced|increased|streamlined|automated|saved|cut|grew|doubled|eliminated)\w*\b/i
    )?.[0];
    suggestions.push({
      type: 'missing-impact',
      message: 'The action is here; the result is not. What changed because of this work, and for whom?',
      fix: changeWord
        ? `You mention "${changeWord}". Say what changed and for whom in the outcome field.`
        : fields.quantifier.trim()
          ? `Tie your number (${fields.quantifier.trim()}) to the outcome it produced.`
          : 'Finish the thought: "...which meant ___ for the team, customer, or class."',
      studentExample:
        'Rebuilt the club sign-up form, doubling completed registrations at the fall activities fair.',
      professionalExample:
        'Standardized the deploy checklist, ending the weekly rollback pattern the team had lived with for a quarter.',
    });
  }

  // Too long
  if (readability.wordCount > 32) {
    suggestions.push({
      type: 'too-long',
      message: `At ${readability.wordCount} words this reads as a paragraph. Keep one action and one outcome; move the rest to a second bullet.`,
      studentExample:
        'Analyzed housing survey data in R for a sociology capstone and presented 3 findings to the department.',
      professionalExample:
        'Owned the quarterly vendor review and cut the supplier list from 12 to 7.',
    });
  }

  // Too short
  if (readability.wordCount > 0 && readability.wordCount < 8) {
    suggestions.push({
      type: 'too-short',
      message: `At ${readability.wordCount} words there is no evidence yet. Add what you worked on, at what scale, and what changed.`,
      studentExample:
        '"Worked in the library" becomes "Staffed the library help desk 12 hours weekly, fielding 40+ patron questions per shift."',
      professionalExample:
        '"Did reporting" becomes "Built the weekly sales report used by 3 regional managers."',
    });
  }

  // Passive voice
  if (readability.passiveVoiceCount > 0) {
    const passiveFragment = current.match(
      /\b(was|were|been|being|is|are|be)\s+\w+(?:ed|en)\b/i
    )?.[0];
    suggestions.push({
      type: 'passive-voice',
      message: passiveFragment
        ? `Passive voice hides the actor: "${passiveFragment}". Lead with what you did.`
        : 'Passive voice hides the actor. Lead with what you did.',
      fix: 'Rewrite as "Built X", not "X was built".',
      studentExample:
        '"Was given responsibility for the club budget" becomes "Managed the club budget of $2,000 across two semesters."',
      professionalExample:
        '"Deployments were handled by me" becomes "Ran all production deployments for a 5-service platform."',
    });
  }

  // Readability
  if (!readability.isReadable && readability.wordCount >= 8 && readability.wordCount <= 32) {
    suggestions.push({
      type: 'readability',
      message: 'Hard to scan. Cut filler, split stacked clauses, and keep one idea per line.',
      studentExample: 'Tutored calculus twice a week, averaging a 4.8 of 5 session rating.',
      professionalExample: 'Wrote the API style guide adopted by all 4 backend teams.',
    });
  }

  return suggestions;
}

export function signalGrade(visible: number): { grade: string; label: string; color: string } {
  if (visible >= 80)
    return { grade: 'A', label: 'Excellent signal', color: 'text-[hsl(var(--love))]' };
  if (visible >= 65) return { grade: 'B', label: 'Good signal', color: 'text-[hsl(var(--foam))]' };
  if (visible >= 50)
    return { grade: 'C', label: 'Moderate signal', color: 'text-[hsl(var(--gold))]' };
  return { grade: 'D', label: 'Weak signal', color: 'text-[hsl(var(--destructive))]' };
}
