import { hasWages } from './pay';
/**
 * Open Graph image definitions. Each entry becomes /og/<slug>.png at build
 * time (see src/pages/og/[slug].png.ts). Base.astro picks the image for the
 * current path with ogImageFor(); pages can still pass an explicit `image`.
 */

export type OgAccent = 'foam' | 'gold' | 'iris' | 'love' | 'lichen' | 'madder';

export interface OgPage {
  /** Small uppercase line above the title. */
  eyebrow: string;
  /** The headline, kept to two lines at 1200x630. */
  title: string;
  /** One supporting sentence. */
  description: string;
  accent: OgAccent;
  /** Roman numeral for the tool plates; omitted on other pages. */
  plate?: string;
}

export const OG_PAGES: Record<string, OgPage> = {
  home: {
    eyebrow: 'Practical career tools',
    title: 'Figure out what you want. Then back it up.',
    description:
      'Six free browser tools that stay on your device: reflect, fix resume bullets, practice intros, prep interview stories, apply, and check pay.',
    accent: 'foam',
  },
  start: {
    eyebrow: 'Career review',
    title: 'Two questions, one place to start.',
    description:
      'Pick where you are right now and what you are stuck on, and the site points you to the right tool.',
    accent: 'foam',
  },
  career: {
    eyebrow: 'Plate I · Reflect',
    plate: 'I',
    title: 'Ask why five times until your answer stops changing.',
    description: 'Dig past your first obvious reason and save what actually matters as a snapshot.',
    accent: 'foam',
  },
  'resume-game': {
    eyebrow: 'Plate II · Prove',
    plate: 'II',
    title: 'Score every bullet. Rewrite the weak ones.',
    description:
      'Action, outcome, and real numbers, one line at a time, until your resume shows what you actually did.',
    accent: 'gold',
  },
  'networking-practice': {
    eyebrow: 'Plate III · Rehearse',
    plate: 'III',
    title: 'Practice your intro before you need it.',
    description: 'Real scenarios, a timer, and honest self-ratings after every round.',
    accent: 'iris',
  },
  'interview-glow-up': {
    eyebrow: 'Plate IV · Prepare',
    plate: 'IV',
    title: 'Break down the job. Line up real stories.',
    description:
      'Turn a job posting into the skills it tests and a short packet of real stories to answer them.',
    accent: 'love',
  },
  application: {
    eyebrow: 'Plate V · Apply',
    plate: 'V',
    title: 'Paste the posting once. Work it through.',
    description:
      'Sort what it asks for, mark where you stand, write two bullets and a cover letter, and check it before sending.',
    accent: 'lichen',
  },
  pay: {
    eyebrow: 'Plate VI · Weigh',
    plate: 'VI',
    title: hasWages
      ? 'What the job usually pays, and what the offer comes out to.'
      : 'What the offer actually comes out to.',
    description: hasWages
      ? 'Dated percentiles from public wage data, plus an offer broken into hourly and yearly numbers.'
      : 'An offer broken down into plain hourly, weekly, and yearly numbers.',
    accent: 'madder',
  },
  dashboard: {
    eyebrow: 'Your work',
    title: 'Everything you saved, in one place.',
    description:
      'Scores, snapshots, practice rounds, and stories, all read straight from your browser.',
    accent: 'foam',
  },
  about: {
    eyebrow: 'About',
    title: 'Why I built this site.',
    description: 'Built by Jonathan R. Reed for students and anyone figuring out their next step.',
    accent: 'gold',
  },
  privacy: {
    eyebrow: 'Privacy',
    title: 'Everything you write stays in your browser.',
    description: 'No accounts, no cookies, and nothing you type gets sent to a server.',
    accent: 'foam',
  },
};

const PATH_TO_SLUG: Record<string, string> = {
  '/': 'home',
  '/start/': 'start',
  '/career/': 'career',
  '/resume-game/': 'resume-game',
  '/networking-practice/': 'networking-practice',
  '/interview-glow-up/': 'interview-glow-up',
  '/interview-glow-up/workspace/': 'interview-glow-up',
  '/interview-glow-up/rehearse/': 'interview-glow-up',
  '/application/': 'application',
  '/pay/': 'pay',
  '/dashboard/': 'dashboard',
  '/about/': 'about',
  '/privacy/': 'privacy',
  '/subprocessors/': 'privacy',
  '/contact/': 'about',
};

/** The generated image path for a route, falling back to the home image. */
export function ogImageFor(pathname: string): string {
  const normalized = pathname.endsWith('/') ? pathname : `${pathname}/`;
  const slug = PATH_TO_SLUG[normalized] ?? PATH_TO_SLUG[pathname] ?? 'home';
  return `/og/${slug}.png`;
}
