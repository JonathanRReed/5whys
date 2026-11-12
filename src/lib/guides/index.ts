import type { Guide, GuideTool } from '../guide';
import { applicationGuide } from './application';
import { careerGuide } from './career';
import { interviewGlowUpGuide } from './interview-glow-up';
import { networkingPracticeGuide } from './networking-practice';
import { payGuide } from './pay';
import { resumeGameGuide } from './resume-game';

/** Every guide that exists. A tool without one simply shows no guide. */
export const GUIDES: Partial<Record<GuideTool, Guide>> = {
  career: careerGuide,
  'resume-game': resumeGameGuide,
  'networking-practice': networkingPracticeGuide,
  'interview-glow-up': interviewGlowUpGuide,
  application: applicationGuide,
  pay: payGuide,
};
