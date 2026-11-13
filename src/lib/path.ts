/**
 * A path: two or three tools in the order that fits one situation, each
 * opened with its guide on. The career review picks one; a tool's guide then
 * hands the visitor to the next stop when it finishes.
 *
 * A stop is done when that tool's guide was finished, so progress is read
 * from the guides and nothing is counted twice. The path itself is a device
 * preference, like the guide choice: one small key, not part of the backup.
 */
import { type GuideTool, loadGuideProgress } from './guide';
import type { CareerFocus } from './profile';

export type PathId = CareerFocus;

export interface PathStop {
  tool: GuideTool;
  /** Where the stop opens. The guide is turned on by the link. */
  href: string;
  /** What the visitor does there, as an instruction. */
  label: string;
  /** What they leave with. */
  gain: string;
}

export interface CareerPath {
  id: PathId;
  title: string;
  stops: PathStop[];
}

const stop = (tool: GuideTool, href: string, label: string, gain: string): PathStop => ({
  tool,
  href,
  label,
  gain,
});

const WHY = (label: string, gain: string) => stop('career', '/career/?guide=1', label, gain);
const RESUME = (label: string, gain: string) =>
  stop('resume-game', '/resume-game/?guide=1', label, gain);
const DESK = (label: string, gain: string) =>
  stop('application', '/application/?guide=1', label, gain);
const STORIES = (label: string, gain: string) =>
  stop('interview-glow-up', '/interview-glow-up/workspace/?guide=1', label, gain);
const REHEARSE = (label: string, gain: string) =>
  stop('rehearsal', '/interview-glow-up/rehearse/?guide=1', label, gain);
const INTRO = (label: string, gain: string) =>
  stop('networking-practice', '/networking-practice/?guide=1', label, gain);
const PAY = (label: string, gain: string) => stop('pay', '/pay/?guide=1', label, gain);

export const PATHS: Record<PathId, CareerPath> = {
  direction: {
    id: 'direction',
    title: 'Work out what you want',
    stops: [
      WHY('Ask why five times', 'The reason under your first answer, in your words.'),
      INTRO('Practice asking someone who does it', 'An introduction for one real conversation.'),
      RESUME('Put what you have on a resume', 'Lines that show the thing you care about.'),
    ],
  },
  starting: {
    id: 'starting',
    title: 'Start from nothing',
    stops: [
      stop(
        'resume-game',
        '/resume-game/?start=blank&guide=1',
        'Build a first resume from a few questions',
        'A resume you can download.'
      ),
      DESK('Read one job ad closely', 'What the job asks for, and where you stand.'),
      REHEARSE('Answer one interview question', 'One answer you have said or written once.'),
    ],
  },
  applying: {
    id: 'applying',
    title: 'Apply to one job',
    stops: [
      DESK('Work the posting through the desk', 'A resume and a letter for this job.'),
      RESUME(
        'Strengthen the weakest resume line',
        'A line that says what you did and what came of it.'
      ),
      STORIES('Prepare a story for the interview', 'One story with proof, ready for the call.'),
    ],
  },
  resume: {
    id: 'resume',
    title: 'Fix the resume',
    stops: [
      RESUME(
        'Score it and rewrite one weak line',
        'A stronger line, and the list of the next ones.'
      ),
      DESK('Fit it to one posting', 'A copy of your resume for one job.'),
    ],
  },
  interview: {
    id: 'interview',
    title: 'Get ready for an interview',
    stops: [
      STORIES(
        'Decode the posting and write a story',
        'What the interview will test, and one story for it.'
      ),
      REHEARSE('Answer the likely questions', 'Answers you have given once before the real thing.'),
      PAY('Put the pay into plain terms', 'What the job pays by the hour, week and year.'),
    ],
  },
  networking: {
    id: 'networking',
    title: 'Introduce yourself',
    stops: [
      INTRO('Practice one short introduction', 'An introduction you have said out loud.'),
      REHEARSE('Answer what they ask back', 'An answer to "tell me about yourself".'),
    ],
  },
  offer: {
    id: 'offer',
    title: 'Answer an offer',
    stops: [
      PAY('Put the offer into plain terms', 'What it pays by the hour, week and year.'),
      WHY('Check it against what you want', 'Your reason, to hold the offer against.'),
    ],
  },
};

export const PATH_STORAGE_KEY = 'career-tools-path';

export const isPathId = (value: unknown): value is PathId =>
  typeof value === 'string' && value in PATHS;

/** The path the visitor is on, or null. */
export function loadPath(): CareerPath | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PATH_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { id?: unknown };
    return isPathId(data?.id) ? PATHS[data.id] : null;
  } catch {
    return null;
  }
}

export function startPath(id: PathId): CareerPath {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PATH_STORAGE_KEY, JSON.stringify({ id }));
    } catch {
      /* storage unavailable: each tool's own guide still works */
    }
  }
  return PATHS[id];
}

export function endPath(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PATH_STORAGE_KEY);
  } catch {
    /* nothing was saved */
  }
}

export interface PathProgress {
  path: CareerPath;
  /** One entry per stop, in order: true when that tool's guide was finished. */
  done: boolean[];
  /** The first stop not yet done, or null when the path is complete. */
  next: PathStop | null;
}

/** Where the visitor is on a path, read from the guides they have finished. */
export function pathProgress(
  path: CareerPath,
  finished: (tool: GuideTool) => boolean = (tool) => loadGuideProgress(tool)?.finished === true
): PathProgress {
  const done = path.stops.map((item) => finished(item.tool));
  return { path, done, next: path.stops.find((_, index) => !done[index]) ?? null };
}

/**
 * The stop after this tool, for the finish card of its guide. Null when the
 * tool is not on the path or is its last stop.
 */
export function stopAfter(path: CareerPath, tool: GuideTool): PathStop | null {
  const at = path.stops.findIndex((item) => item.tool === tool);
  return at >= 0 ? (path.stops[at + 1] ?? null) : null;
}

/** "Stop 2 of 3", or null when the tool is not on the path. */
export function stopPosition(path: CareerPath, tool: GuideTool): number | null {
  const at = path.stops.findIndex((item) => item.tool === tool);
  return at >= 0 ? at + 1 : null;
}
