/**
 * Interview Glow Up - Skill Bank & Question Bank
 *
 * Single source-of-truth for skills, question prompts, and JD text analysis.
 * Add/rename skills here without refactoring the rest of the app.
 */

import { escapeRegExp } from './posting/text';

// ============================================================================
// Skill Bank
// ============================================================================

export interface Skill {
  id: string;
  name: string;
  category: 'technical' | 'soft' | 'domain' | 'general';
  keywords: string[]; // For auto-detection
}

export const SKILL_BANK: Skill[] = [
  // Technical Skills
  {
    id: 'python',
    name: 'Python',
    category: 'technical',
    keywords: ['python', 'django', 'flask', 'fastapi', 'pandas', 'numpy'],
  },
  {
    id: 'javascript',
    name: 'JavaScript',
    category: 'technical',
    keywords: ['javascript', 'js', 'typescript', 'ts', 'node', 'react', 'vue', 'angular'],
  },
  {
    id: 'java',
    name: 'Java',
    category: 'technical',
    keywords: ['java', 'spring', 'maven', 'gradle', 'jvm'],
  },
  {
    id: 'sql',
    name: 'SQL/Databases',
    category: 'technical',
    keywords: ['sql', 'mysql', 'postgresql', 'database', 'databases', 'mongodb', 'redis', 'nosql'],
  },
  {
    id: 'cloud',
    name: 'Cloud (AWS/GCP/Azure)',
    category: 'technical',
    keywords: ['aws', 'gcp', 'azure', 'cloud', 'ec2', 's3', 'lambda', 'kubernetes', 'docker'],
  },
  {
    id: 'ml',
    name: 'Machine Learning/AI',
    category: 'technical',
    keywords: [
      'machine learning',
      'ml',
      'ai',
      'deep learning',
      'tensorflow',
      'pytorch',
      'nlp',
      'llm',
    ],
  },
  {
    id: 'security',
    name: 'Security/Cybersecurity',
    category: 'technical',
    keywords: [
      'security',
      'cybersecurity',
      'encryption',
      'vulnerability',
      'penetration',
      'soc',
      'siem',
    ],
  },
  {
    id: 'devops',
    name: 'DevOps/CI-CD',
    category: 'technical',
    keywords: [
      'devops',
      'ci/cd',
      'jenkins',
      'github actions',
      'terraform',
      'ansible',
      'infrastructure',
    ],
  },
  {
    id: 'api',
    name: 'API Design',
    category: 'technical',
    keywords: ['api', 'apis', 'rest', 'graphql', 'grpc', 'microservices', 'api integration'],
  },
  {
    id: 'frontend',
    name: 'Frontend Development',
    category: 'technical',
    keywords: ['frontend', 'front-end', 'css', 'html', 'ui', 'responsive', 'accessibility'],
  },
  {
    id: 'backend',
    name: 'Backend Development',
    category: 'technical',
    keywords: ['backend', 'back-end', 'server', 'scalability', 'architecture'],
  },
  {
    id: 'mobile',
    name: 'Mobile Development',
    category: 'technical',
    keywords: ['mobile', 'ios', 'android', 'react native', 'flutter', 'swift', 'kotlin'],
  },
  {
    id: 'data-analysis',
    name: 'Data Analysis',
    category: 'technical',
    keywords: ['data analysis', 'analytics', 'visualization', 'tableau', 'power bi', 'excel'],
  },

  // Soft Skills
  {
    id: 'communication',
    name: 'Communication',
    category: 'soft',
    keywords: [
      'communication',
      'communicate',
      'present',
      'presentation',
      'stakeholder',
      'stakeholders',
      'written',
      'verbal',
    ],
  },
  {
    id: 'leadership',
    name: 'Leadership',
    category: 'soft',
    keywords: [
      'leadership',
      'lead',
      'leading',
      'manage',
      'management',
      'mentor',
      'coach',
      'influence',
      'vision',
    ],
  },
  {
    id: 'teamwork',
    name: 'Teamwork',
    category: 'soft',
    keywords: [
      'teamwork',
      'team player',
      'collaborate',
      'collaboration',
      'cross-functional',
      'partner with',
    ],
  },
  {
    id: 'problem-solving',
    name: 'Problem Solving',
    category: 'soft',
    keywords: [
      'problem solving',
      'problem-solving',
      'troubleshoot',
      'debug',
      'root cause',
      'analytical',
      'critical thinking',
    ],
  },
  {
    id: 'adaptability',
    name: 'Adaptability',
    category: 'soft',
    keywords: ['adaptability', 'flexible', 'ambiguity', 'change', 'pivot', 'fast-paced'],
  },
  {
    id: 'time-management',
    name: 'Time Management',
    category: 'soft',
    keywords: ['time management', 'prioritize', 'deadline', 'deadlines', 'multitask', 'organize'],
  },
  {
    id: 'ownership',
    name: 'Ownership/Initiative',
    category: 'soft',
    keywords: ['ownership', 'initiative', 'proactive', 'self-starter', 'autonomous', 'end-to-end'],
  },
  {
    id: 'attention-to-detail',
    name: 'Attention to Detail',
    category: 'soft',
    keywords: ['attention to detail', 'detail-oriented', 'meticulous', 'quality', 'accuracy'],
  },

  // Domain Skills
  {
    id: 'agile',
    name: 'Agile/Scrum',
    category: 'domain',
    keywords: ['agile', 'scrum', 'sprint', 'kanban', 'jira', 'standup'],
  },
  {
    id: 'product',
    name: 'Product Thinking',
    category: 'domain',
    keywords: ['product', 'roadmap', 'requirements', 'user stories', 'prd', 'backlog'],
  },
  {
    id: 'ux',
    name: 'UX/User Research',
    category: 'domain',
    keywords: [
      'ux',
      'user experience',
      'user research',
      'usability',
      'design thinking',
      'wireframe',
    ],
  },
  {
    id: 'finance',
    name: 'Finance/Fintech',
    category: 'domain',
    keywords: ['finance', 'fintech', 'banking', 'payments', 'trading', 'compliance'],
  },
  {
    id: 'healthcare',
    name: 'Healthcare/Biotech',
    category: 'domain',
    keywords: ['healthcare', 'hipaa', 'clinical', 'biotech', 'pharma', 'medical'],
  },
  {
    id: 'ecommerce',
    name: 'E-commerce/Retail',
    category: 'domain',
    keywords: ['ecommerce', 'e-commerce', 'retail', 'marketplace', 'inventory', 'supply chain'],
  },

  // General
  { id: 'general', name: 'General', category: 'general', keywords: [] },
];

export const SKILL_MAP = new Map(SKILL_BANK.map((s) => [s.id, s]));

export function getSkillName(id: string): string {
  return SKILL_MAP.get(id)?.name ?? id;
}

// ============================================================================
// Smart Skill Detection (word-boundary matching, no fabricated confidence)
// ============================================================================

export interface SkillSuggestion {
  skillId: string;
  /** The exact keywords from the skill's list that appeared in the text. */
  matchedKeywords: string[];
}

const keywordRegexCache = new Map<string, RegExp>();

/**
 * Builds a boundary-safe matcher for a keyword. Plain substring matching
 * produced false positives ('ts' inside 'projects', 'ai' inside 'email',
 * 'ml' inside 'html'), so we require a non-alphanumeric character or the
 * string edge on both sides of the keyword.
 */
function keywordRegex(keyword: string): RegExp {
  let regex = keywordRegexCache.get(keyword);
  if (!regex) {
    regex = new RegExp(`(?:^|[^a-z0-9+#])${escapeRegExp(keyword)}(?:$|[^a-z0-9+#])`, 'i');
    keywordRegexCache.set(keyword, regex);
  }
  return regex;
}

// Pre-computed skill entries with lowercased keywords to avoid repeated string operations.
const SKILL_BANK_ENTRIES = SKILL_BANK.map((skill) => ({
  skill,
  keywordsWithLower: skill.keywords.map((kw) => ({
    kw,
    lowerKw: kw.toLowerCase(),
  })),
}));

/**
 * Smart skill detection using word-boundary matching.
 *
 * Performance optimization: Pre-lowercases input text and checks `lowerText.includes(lowerKw)`
 * as a fast path before executing regex evaluation. This skips RegExp execution for keywords
 * that are completely absent from the text, drastically reducing CPU time per line during live editing.
 */
export function detectSkillsFromText(text: string): SkillSuggestion[] {
  const suggestions: SkillSuggestion[] = [];
  const lowerText = text.toLowerCase();

  for (const { skill, keywordsWithLower } of SKILL_BANK_ENTRIES) {
    if (keywordsWithLower.length === 0) continue;
    const matchedKeywords: string[] = [];
    for (const { kw, lowerKw } of keywordsWithLower) {
      // Fast path: skip RegExp if lowerKw substring is not present in lowerText
      if (lowerText.includes(lowerKw) && keywordRegex(kw).test(text)) {
        matchedKeywords.push(kw);
      }
    }
    if (matchedKeywords.length > 0) {
      suggestions.push({ skillId: skill.id, matchedKeywords });
    }
  }

  // Skills with more distinct keyword hits rank higher.
  suggestions.sort((a, b) => b.matchedKeywords.length - a.matchedKeywords.length);

  return suggestions.slice(0, 3);
}

// ============================================================================
// JD Line Extraction and Repeated Phrase Counting
// ============================================================================

// Both moved to the posting engine (src/lib/posting/), which builds sections,
// spans, and term matching on top of them. Re-exported so existing imports
// keep working.
export { extractRequirementLines, type JdExtractionResult } from './posting/lines';
export { getRepeatedTerms, type RepeatedTerm } from './posting/terms';

// ============================================================================
// Question Bank
// ============================================================================

export interface QuestionPrompt {
  id: string;
  text: string;
  skillIds: string[]; // Can apply to multiple skills
  category: 'behavioral' | 'technical' | 'situational' | 'general';
}

export const QUESTION_BANK: QuestionPrompt[] = [
  // General Questions
  { id: 'q-intro', text: 'Tell me about yourself.', skillIds: ['general'], category: 'general' },
  {
    id: 'q-why-company',
    text: 'Why do you want to work here?',
    skillIds: ['general'],
    category: 'general',
  },
  {
    id: 'q-why-role',
    text: 'Why are you interested in this role?',
    skillIds: ['general'],
    category: 'general',
  },
  {
    id: 'q-strengths',
    text: 'What are your greatest strengths?',
    skillIds: ['general'],
    category: 'general',
  },
  {
    id: 'q-weaknesses',
    text: 'What is your biggest weakness?',
    skillIds: ['general'],
    category: 'general',
  },
  {
    id: 'q-five-years',
    text: 'Where do you see yourself in five years?',
    skillIds: ['general'],
    category: 'general',
  },

  // Student and early-career staples
  {
    id: 'q-stu-resume',
    text: 'Walk me through your resume.',
    skillIds: ['general'],
    category: 'general',
  },
  {
    id: 'q-stu-no-exp',
    text: "You don't have industry experience. Why should we hire you?",
    skillIds: ['general'],
    category: 'general',
  },
  {
    id: 'q-stu-major',
    text: 'Why did you choose your major?',
    skillIds: ['general'],
    category: 'general',
  },
  {
    id: 'q-stu-class-project',
    text: "Tell me about a class project you're proud of. What was your specific contribution?",
    skillIds: ['ownership', 'teamwork'],
    category: 'behavioral',
  },
  {
    id: 'q-stu-group-conflict',
    text: 'Tell me about a group project where a teammate was not pulling their weight. What did you do?',
    skillIds: ['teamwork', 'communication'],
    category: 'behavioral',
  },
  {
    id: 'q-stu-overwhelmed',
    text: 'Tell me about a time coursework got overwhelming. How did you get through it?',
    skillIds: ['time-management', 'adaptability'],
    category: 'behavioral',
  },
  {
    id: 'q-stu-balance',
    text: 'How did you balance school with work, clubs, or other commitments?',
    skillIds: ['time-management'],
    category: 'behavioral',
  },
  {
    id: 'q-stu-internship',
    text: 'What did you learn during your internship that you could not have learned in class?',
    skillIds: ['adaptability', 'general'],
    category: 'behavioral',
  },
  {
    id: 'q-stu-club',
    text: 'Tell me about something you organized or led in a club or student organization.',
    skillIds: ['leadership', 'ownership'],
    category: 'behavioral',
  },
  {
    id: 'q-stu-parttime',
    text: 'What did your part-time job teach you about working with people?',
    skillIds: ['teamwork', 'communication'],
    category: 'behavioral',
  },
  {
    id: 'q-stu-course',
    text: 'Which course challenged you the most, and how did you handle it?',
    skillIds: ['adaptability', 'problem-solving'],
    category: 'behavioral',
  },
  {
    id: 'q-stu-feedback',
    text: 'Tell me about a time you got tough feedback from a professor or manager. What did you change?',
    skillIds: ['adaptability', 'communication'],
    category: 'behavioral',
  },
  {
    id: 'q-stu-teach',
    text: 'Describe a time you tutored or taught someone. How did you know it worked?',
    skillIds: ['communication', 'leadership'],
    category: 'behavioral',
  },

  // Leadership
  {
    id: 'q-lead-project',
    text: 'Tell me about a time you led a project.',
    skillIds: ['leadership', 'ownership'],
    category: 'behavioral',
  },
  {
    id: 'q-lead-conflict',
    text: 'How do you handle conflict within your team?',
    skillIds: ['leadership', 'communication'],
    category: 'behavioral',
  },
  {
    id: 'q-lead-mentor',
    text: 'Describe a time you mentored someone.',
    skillIds: ['leadership', 'teamwork'],
    category: 'behavioral',
  },
  {
    id: 'q-lead-decision',
    text: 'Tell me about a difficult decision you had to make as a leader.',
    skillIds: ['leadership', 'problem-solving'],
    category: 'behavioral',
  },

  // Problem Solving
  {
    id: 'q-ps-complex',
    text: 'Describe a complex problem you solved.',
    skillIds: ['problem-solving'],
    category: 'behavioral',
  },
  {
    id: 'q-ps-debug',
    text: 'Walk me through how you debug a production issue.',
    skillIds: ['problem-solving', 'backend'],
    category: 'technical',
  },
  {
    id: 'q-ps-tradeoff',
    text: 'Tell me about a time you had to make a tradeoff.',
    skillIds: ['problem-solving', 'product'],
    category: 'situational',
  },
  {
    id: 'q-ps-ambiguity',
    text: 'How do you handle ambiguous requirements?',
    skillIds: ['problem-solving', 'adaptability'],
    category: 'situational',
  },

  // Communication
  {
    id: 'q-comm-explain',
    text: 'Explain a technical concept to a non-technical audience.',
    skillIds: ['communication'],
    category: 'behavioral',
  },
  {
    id: 'q-comm-disagree',
    text: 'Tell me about a time you disagreed with a stakeholder.',
    skillIds: ['communication', 'leadership'],
    category: 'behavioral',
  },
  {
    id: 'q-comm-feedback',
    text: 'How do you give and receive feedback?',
    skillIds: ['communication', 'teamwork'],
    category: 'behavioral',
  },

  // Teamwork
  {
    id: 'q-team-collab',
    text: 'Describe a successful cross-functional collaboration.',
    skillIds: ['teamwork', 'communication'],
    category: 'behavioral',
  },
  {
    id: 'q-team-difficult',
    text: 'Tell me about a time you worked with a difficult teammate.',
    skillIds: ['teamwork', 'adaptability'],
    category: 'behavioral',
  },
  {
    id: 'q-team-remote',
    text: 'How do you collaborate with remote team members?',
    skillIds: ['teamwork', 'communication'],
    category: 'situational',
  },

  // Ownership
  {
    id: 'q-own-initiative',
    text: 'Tell me about a time you took initiative beyond your role.',
    skillIds: ['ownership'],
    category: 'behavioral',
  },
  {
    id: 'q-own-failure',
    text: 'Describe a project that failed. What did you learn?',
    skillIds: ['ownership', 'problem-solving'],
    category: 'behavioral',
  },
  {
    id: 'q-own-improve',
    text: 'Tell me about a process you improved.',
    skillIds: ['ownership', 'problem-solving'],
    category: 'behavioral',
  },

  // Adaptability
  {
    id: 'q-adapt-change',
    text: 'Describe a time requirements changed mid-project.',
    skillIds: ['adaptability', 'agile'],
    category: 'situational',
  },
  {
    id: 'q-adapt-learn',
    text: 'Tell me about a time you had to learn something quickly.',
    skillIds: ['adaptability'],
    category: 'behavioral',
  },
  {
    id: 'q-adapt-pressure',
    text: 'How do you perform under pressure?',
    skillIds: ['adaptability', 'time-management'],
    category: 'situational',
  },

  // Time Management
  {
    id: 'q-time-priority',
    text: 'How do you prioritize competing deadlines?',
    skillIds: ['time-management'],
    category: 'situational',
  },
  {
    id: 'q-time-missed',
    text: 'Tell me about a time you missed a deadline. What happened?',
    skillIds: ['time-management', 'ownership'],
    category: 'behavioral',
  },

  // Attention to Detail
  {
    id: 'q-detail-catch',
    text: 'Tell me about a time you caught a mistake everyone else missed.',
    skillIds: ['attention-to-detail'],
    category: 'behavioral',
  },
  {
    id: 'q-detail-process',
    text: 'What is your process for checking work before you call it done?',
    skillIds: ['attention-to-detail', 'ownership'],
    category: 'situational',
  },

  // Python
  {
    id: 'q-py-project',
    text: 'Walk me through a Python project you have built. What did it do, and what was the hardest part?',
    skillIds: ['python', 'problem-solving'],
    category: 'technical',
  },
  {
    id: 'q-py-quality',
    text: 'How do you keep a growing Python codebase readable and tested?',
    skillIds: ['python', 'attention-to-detail'],
    category: 'technical',
  },

  // JavaScript
  {
    id: 'q-js-build',
    text: 'Tell me about something you built with JavaScript or a framework like React. What broke first, and how did you fix it?',
    skillIds: ['javascript', 'frontend'],
    category: 'technical',
  },
  {
    id: 'q-js-async',
    text: 'How have you handled asynchronous code or API calls in JavaScript? Give a concrete example.',
    skillIds: ['javascript', 'api'],
    category: 'technical',
  },

  // Java
  {
    id: 'q-java-design',
    text: 'Describe a Java project you have worked on. How did you decide how to structure the classes?',
    skillIds: ['java', 'backend'],
    category: 'technical',
  },

  // SQL/Databases
  {
    id: 'q-sql-question',
    text: 'Tell me about a time you used SQL to answer a real question. What did the query need to find?',
    skillIds: ['sql', 'data-analysis'],
    category: 'technical',
  },
  {
    id: 'q-sql-slow',
    text: 'A query is slow. Walk me through how you would find out why and speed it up.',
    skillIds: ['sql', 'problem-solving'],
    category: 'technical',
  },

  // Machine Learning
  {
    id: 'q-ml-endtoend',
    text: 'Walk me through a machine learning project end to end: the data, the model, and how you evaluated it.',
    skillIds: ['ml', 'data-analysis'],
    category: 'technical',
  },
  {
    id: 'q-ml-overfit',
    text: 'How do you tell when a model is overfitting, and what have you actually done about it?',
    skillIds: ['ml'],
    category: 'technical',
  },

  // Security
  {
    id: 'q-sec-risk',
    text: 'Tell me about a security risk or vulnerability you found. What did you do next?',
    skillIds: ['security', 'attention-to-detail'],
    category: 'technical',
  },
  {
    id: 'q-sec-explain',
    text: 'Explain a common attack, like SQL injection or phishing, to someone non-technical.',
    skillIds: ['security', 'communication'],
    category: 'technical',
  },

  // Frontend
  {
    id: 'q-fe-ui',
    text: 'Tell me about an interface you built. How did you handle responsiveness or accessibility?',
    skillIds: ['frontend', 'ux'],
    category: 'technical',
  },
  {
    id: 'q-fe-perf',
    text: 'A page loads slowly. What do you check first?',
    skillIds: ['frontend', 'problem-solving'],
    category: 'technical',
  },

  // Mobile
  {
    id: 'q-mob-app',
    text: 'Describe a mobile app you have built or contributed to. What platform constraint surprised you?',
    skillIds: ['mobile'],
    category: 'technical',
  },

  // Data Analysis
  {
    id: 'q-data-decision',
    text: 'Tell me about a time your analysis changed a decision. What did you find?',
    skillIds: ['data-analysis', 'communication'],
    category: 'behavioral',
  },
  {
    id: 'q-data-messy',
    text: 'You get a messy dataset. Walk me through how you would clean and sanity-check it.',
    skillIds: ['data-analysis', 'attention-to-detail'],
    category: 'technical',
  },

  // UX
  {
    id: 'q-ux-feedback',
    text: 'Tell me about a time user feedback changed your design.',
    skillIds: ['ux', 'adaptability'],
    category: 'behavioral',
  },
  {
    id: 'q-ux-research',
    text: 'How do you decide what to test with users, and what did you learn the last time you did?',
    skillIds: ['ux', 'product'],
    category: 'situational',
  },

  // Finance
  {
    id: 'q-fin-accuracy',
    text: 'When the numbers have to be exactly right, how do you check your work? Give me an example.',
    skillIds: ['finance', 'attention-to-detail'],
    category: 'behavioral',
  },

  // Healthcare
  {
    id: 'q-health-sensitive',
    text: 'Tell me about a time you handled sensitive or regulated data. What rules did you have to follow?',
    skillIds: ['healthcare', 'security'],
    category: 'behavioral',
  },

  // E-commerce
  {
    id: 'q-ecom-funnel',
    text: 'Describe a time you improved a customer-facing flow. How did you measure whether it worked?',
    skillIds: ['ecommerce', 'data-analysis'],
    category: 'behavioral',
  },

  // Technical - General
  {
    id: 'q-tech-design',
    text: 'Walk me through a system you designed.',
    skillIds: ['backend', 'api', 'cloud'],
    category: 'technical',
  },
  {
    id: 'q-tech-scale',
    text: 'How would you scale a service handling 10x traffic?',
    skillIds: ['backend', 'cloud', 'devops'],
    category: 'technical',
  },
  {
    id: 'q-tech-learn',
    text: 'How do you stay current with new technologies?',
    skillIds: ['general'],
    category: 'behavioral',
  },
];

// Pre-indexed Map structures for O(1) Question Bank lookups instead of O(N) linear array searches
// during UI rendering and question resolution.
export const QUESTION_MAP = new Map<string, QuestionPrompt>(QUESTION_BANK.map((q) => [q.id, q]));

const QUESTIONS_BY_SKILL_MAP = (() => {
  const map = new Map<string, QuestionPrompt[]>();
  for (const question of QUESTION_BANK) {
    for (const skillId of question.skillIds) {
      let list = map.get(skillId);
      if (!list) {
        list = [];
        map.set(skillId, list);
      }
      list.push(question);
    }
  }
  return map;
})();

/**
 * Questions tagged to a specific skill. Does not mix in general questions;
 * use getGeneralQuestions() for those.
 * Uses an indexed lookup plus O(k) copying to preserve independent results.
 */
export function getQuestionsForSkill(skillId: string): QuestionPrompt[] {
  return [...(QUESTIONS_BY_SKILL_MAP.get(skillId) ?? [])];
}

export function getGeneralQuestions(): QuestionPrompt[] {
  return getQuestionsForSkill('general');
}

/**
 * Finds a question by ID in O(1) time.
 */
export function getQuestionById(id: string): QuestionPrompt | undefined {
  return QUESTION_MAP.get(id);
}

/**
 * Story.questionPrompts holds bank question ids for attached questions and
 * raw text for custom ones. This resolves either to display text.
 */
export function resolveQuestionText(idOrText: string): string {
  return QUESTION_MAP.get(idOrText)?.text ?? idOrText;
}

// ============================================================================
// Suggested Questions to Ask (for Packet)
// ============================================================================

export const SUGGESTED_QUESTIONS_TO_ASK = [
  'What does success look like in this role after 90 days?',
  'How does the team prioritize when requirements change?',
  "What's the biggest challenge the team is facing right now?",
  'How would you describe the team culture?',
  'What opportunities are there for growth and learning?',
  'Can you walk me through a typical project lifecycle here?',
  'How does the team handle technical debt?',
  "What's the onboarding process like?",
  'How do you measure performance?',
  'What do you enjoy most about working here?',
];
