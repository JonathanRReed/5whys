/**
 * Open Graph image definitions. Each entry becomes /og/<slug>.png at build
 * time (see src/pages/og/[slug].png.ts). Base.astro picks the image for the
 * current path with ogImageFor(); pages can still pass an explicit `image`.
 */

export type OgAccent = 'foam' | 'gold' | 'iris' | 'love';

export interface OgPage {
  /** Small uppercase line above the title. */
  eyebrow: string;
  /** The headline, kept to two lines at 1200x630. */
  title: string;
  /** One supporting sentence. */
  description: string;
  accent: OgAccent;
  /** Roman numeral for the four tool plates; omitted on other pages. */
  plate?: string;
}

export const OG_PAGES: Record<string, OgPage> = {
  home: {
    eyebrow: 'A field guide to professional life',
    title: 'Find the real reason. Then build the proof.',
    description:
      'Four career tools that stay in your browser: reflect, score a resume, rehearse an intro, prepare interview stories.',
    accent: 'foam',
  },
  start: {
    eyebrow: 'Career review',
    title: 'Two questions, one starting point.',
    description:
      'Say where you are and what you are working on. The studio picks the tool to open first.',
    accent: 'foam',
  },
  career: {
    eyebrow: 'Plate I · Reflect',
    plate: 'I',
    title: 'Ask why five times until the answer stops moving.',
    description: 'Name the motivation underneath the obvious one, then keep it as a snapshot.',
    accent: 'foam',
  },
  'resume-game': {
    eyebrow: 'Plate II · Prove',
    plate: 'II',
    title: 'Score every bullet. Rewrite the weak ones.',
    description:
      'Action, result, and measure, one line at a time, until each bullet carries proof.',
    accent: 'gold',
  },
  'networking-practice': {
    eyebrow: 'Plate III · Rehearse',
    plate: 'III',
    title: 'Practice the conversation before it matters.',
    description: 'Real scenarios, a two-minute timer, and honest self-ratings after every rep.',
    accent: 'iris',
  },
  'interview-glow-up': {
    eyebrow: 'Plate IV · Prepare',
    plate: 'IV',
    title: 'Decode the job. Build the stories. Pack the proof.',
    description:
      'Turn a job description into the skills it tests and a packet of stories that answer them.',
    accent: 'love',
  },
  dashboard: {
    eyebrow: 'Your studio',
    title: 'Everything you saved, in one place.',
    description: 'Scores, snapshots, practice rounds, and stories, all read from your own browser.',
    accent: 'foam',
  },
  about: {
    eyebrow: 'About',
    title: 'Why this studio exists.',
    description:
      'Made by Jonathan R. Reed for students and early-career people finding their path.',
    accent: 'gold',
  },
  privacy: {
    eyebrow: 'Privacy',
    title: 'Everything you write stays in your browser.',
    description: 'No accounts, no cookies, and nothing you type is sent to a server.',
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
