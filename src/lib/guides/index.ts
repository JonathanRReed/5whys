import type { Guide, GuideTool } from '../guide';
import { applicationGuide } from './application';
import { resumeGameGuide } from './resume-game';

/** Every guide that exists. A tool without one simply shows no guide. */
export const GUIDES: Partial<Record<GuideTool, Guide>> = {
  'resume-game': resumeGameGuide,
  application: applicationGuide,
};
