/**
 * The Glow Up pages once opened in software-engineer language for an
 * audience of students and career changers (student walkthrough, finding 13).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const files = [
  'src/pages/interview-glow-up/index.astro',
  'src/pages/interview-glow-up/workspace.astro',
  'src/pages/interview-glow-up/rehearse.astro',
  'src/components/interview-glow-up/InterviewGlowUpAdvice.tsx',
  'src/components/interview-glow-up/DecodeSection.tsx',
  'src/components/interview-glow-up/StoriesSection.tsx',
  'src/components/interview-glow-up/PacketSection.tsx',
  'src/components/interview-glow-up/InterviewHUD.tsx',
  'src/components/rehearsal/RehearsalRoom.tsx',
  'src/components/rehearsal/TakeReview.tsx',
];
const source = Object.fromEntries(files.map((file) => [file, readFileSync(file, 'utf8')]));

describe('Glow Up copy', () => {
  it.each([
    'Decode the JD',
    'JD decoding',
    'JWT',
    'revenue',
    'Panic-proof',
    'panic-proof',
    'PANIC ANSWER',
    'technical interviews, research conversations, customer engineering calls',
    'API redesign',
    'capstone demo',
    'Our legacy API',
    'One story usually proves 2-3 skills',
  ])('no longer says "%s"', (phrase) => {
    for (const [file, text] of Object.entries(source)) {
      expect(text.includes(phrase), `${phrase} in ${file}`).toBe(false);
    }
  });

  it('says what the HUD is where it first appears on each page', () => {
    expect(source['src/pages/interview-glow-up/index.astro']).toMatch(
      /one-screen cheat sheet for the call/
    );
    expect(source['src/pages/interview-glow-up/workspace.astro']).toMatch(
      /HUD, a one-screen cheat sheet for the call/
    );
    expect(source['src/components/interview-glow-up/PacketSection.tsx']).toMatch(
      /The HUD is a one-screen cheat sheet for the call/
    );
  });

  it('explains Trigger, Hook, Play, and Proof in a short phrase', () => {
    for (const file of [
      'src/components/interview-glow-up/StoriesSection.tsx',
      'src/components/interview-glow-up/InterviewGlowUpAdvice.tsx',
    ]) {
      const text = source[file];
      expect(text, file).toMatch(/Trigger[\s\S]{0,160}?a short name/i);
      expect(text, file).toMatch(/Hook/);
      expect(text, file).toMatch(/Play/);
      expect(text, file).toMatch(/Proof/);
    }
  });

  it('carries work examples beside the student ones', () => {
    expect(source['src/components/interview-glow-up/StoriesSection.tsx']).toMatch(/shift/);
    expect(source['src/components/interview-glow-up/StoriesSection.tsx']).toMatch(/inventory/i);
    expect(source['src/components/interview-glow-up/InterviewGlowUpAdvice.tsx']).toMatch(
      /Changing careers\?/
    );
  });

  it('uses no em dashes in copy', () => {
    for (const [file, text] of Object.entries(source)) {
      // Pattern code may name the character; copy may not.
      const copy = text.split('\n').filter((line) => !/\.replace\(|RegExp|\/.*[–—].*\//.test(line));
      expect(copy.join('\n'), file).not.toMatch(/—/);
    }
  });
});
