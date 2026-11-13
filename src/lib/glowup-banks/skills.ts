/**
 * The skill bank: the skills a posting can test and a story can prove.
 *
 * `keywords` are words and phrases that name the skill on their own; the
 * posting engine reads them too (src/lib/posting/match.ts). `tagOnly` words
 * also name the skill on their own but are read only by the decode screen's
 * tagging, so adding one never changes the posting engine's matching. A word
 * that means the skill only in some sentences ("schedule" in "flexible
 * schedule", "lead" in "lead time") goes in `contextual` with the context it
 * needs, and KEYWORD_CONTEXT adds context to existing keywords for tagging
 * only. Ids never change: saved stories and requirement tags refer to them.
 */

export interface KeywordContext {
  /** The keyword counts only when the text right before it matches (anchor with `$`). */
  needsBefore?: RegExp;
  /** The keyword counts only when the text right after it matches (anchor with `^`). */
  needsAfter?: RegExp;
  /** The keyword counts only when the whole line also matches. */
  needsLine?: RegExp;
  /** The keyword does not count when the text right before it matches. */
  notBefore?: RegExp;
  /** The keyword does not count when the text right after it matches. */
  notAfter?: RegExp;
  /** The keyword does not count when the whole line matches. */
  notLine?: RegExp;
}

export interface Skill {
  id: string;
  name: string;
  category: 'technical' | 'soft' | 'domain' | 'general';
  /**
   * Words and phrases that name this skill wherever they appear. The posting
   * engine reads these as requirement terms.
   */
  keywords: string[];
  /**
   * Words that name this skill wherever they appear but that only the decode
   * screen's tagging reads. Kept apart so the posting engine's matching does
   * not change underneath it; it can adopt them deliberately.
   */
  tagOnly?: string[];
  /** Words that name this skill only in the right context. Tagging only. */
  contextual?: Record<string, KeywordContext>;
}

/**
 * A line that asks for analysis, not just a spreadsheet: "analyze visit
 * trends in Excel" is data analysis, "track pantry visits in a spreadsheet"
 * is record keeping.
 */
const ANALYSIS_LINE =
  /\b(?:analy[sz]\w*|analytics|trends?|metrics|insights?|forecast\w*|dashboards?|pivot|visuali[sz]\w*|statistic\w*|reports?|reporting|kpis?)\b/i;

/** Spreadsheet words that are record keeping unless the line asks for analysis. */
const SPREADSHEET_RECORDS: Record<string, KeywordContext> = {
  spreadsheet: { notLine: ANALYSIS_LINE },
  spreadsheets: { notLine: ANALYSIS_LINE },
  'google sheets': { notLine: ANALYSIS_LINE },
  // KEYWORD_CONTEXT asks "excel" for an analysis line; here it must not.
  excel: { needsLine: undefined, notLine: ANALYSIS_LINE },
};

/** People, not tasks: "lead a team", "manage associates". */
const PEOPLE_AFTER =
  /^\s+(?:(?:a|the|our|your|small|large)\s+)?(?:\w+\s+)?(?:team|teams|people|staff|associates|employees|direct reports|crew|crews|volunteers|others|interns|cashiers|workers)\b/i;

export const SKILL_BANK: Skill[] = [
  // Technical
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
    tagOnly: [
      'pivot table',
      'pivot tables',
      'vlookup',
      'xlookup',
      'dashboard',
      'dashboards',
      'weekly reports',
      'monthly reports',
    ],
    contextual: {
      spreadsheet: { needsLine: ANALYSIS_LINE },
      spreadsheets: { needsLine: ANALYSIS_LINE },
      'google sheets': { needsLine: ANALYSIS_LINE },
      reporting: { notAfter: /^\s+(?:to|directly)\b/i },
      reports: { notBefore: /\bdirect\s+$/i, notAfter: /^\s+to\b/i },
    },
  },

  // Soft skills
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
    tagOnly: ['presentations', 'public speaking'],
    contextual: {
      presenting: {},
    },
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
    tagOnly: [
      'people management',
      'team management',
      'mentoring',
      'coaching',
      'supervise',
      'supervising',
      'supervisory',
    ],
    contextual: {
      supervisor: { notBefore: /\b(?:to|your|a|the|with)\s+$/i },
    },
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
    tagOnly: ['work closely with'],
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
    tagOnly: ['troubleshooting'],
    contextual: {
      resolve: {},
      resolving: {},
      resolution: {},
    },
  },
  {
    id: 'adaptability',
    name: 'Adaptability',
    category: 'soft',
    keywords: ['adaptability', 'flexible', 'ambiguity', 'change', 'pivot', 'fast-paced'],
    contextual: {
      adaptable: {},
    },
  },
  {
    id: 'time-management',
    name: 'Time Management',
    category: 'soft',
    keywords: ['time management', 'prioritize', 'deadline', 'deadlines', 'multitask', 'organize'],
    tagOnly: [
      'multiple priorities',
      'competing deadlines',
      'competing priorities',
      'multitasking',
      'organizational skills',
    ],
    contextual: {
      prioritizing: {},
      priorities: {},
      juggle: {},
      organized: {},
    },
  },
  {
    id: 'ownership',
    name: 'Ownership/Initiative',
    category: 'soft',
    keywords: ['ownership', 'initiative', 'proactive', 'self-starter', 'autonomous', 'end-to-end'],
    contextual: {
      own: {
        needsAfter:
          /^\s+(?:them|it|the|each|every|issues?|problems?|projects?|outcomes?|results?|tasks?)\b/i,
        notBefore: /\b(?:your|their|our|my|his|her|its)\s+$/i,
      },
    },
  },
  {
    id: 'attention-to-detail',
    name: 'Attention to Detail',
    category: 'soft',
    keywords: ['attention to detail', 'detail-oriented', 'meticulous', 'quality', 'accuracy'],
    tagOnly: ['detail oriented', 'error-free', 'proofreading'],
    contextual: {
      accurate: {},
      accurately: {},
    },
  },

  // Domain
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
    // "inventory" and "supply chain" moved to their own skills: a logistics
    // posting is not a retail posting.
    keywords: ['ecommerce', 'e-commerce', 'retail', 'marketplace'],
    tagOnly: ['online store', 'merchandising'],
    contextual: {
      pos: { needsLine: /\b(?:register|registers|system|rollout|retail|store|cash)\b/i },
    },
  },

  // Operations, logistics, and office work. Added after the career-changer
  // walkthrough: an operations posting tagged as Leadership and Retail.
  {
    id: 'operations',
    name: 'Operations',
    category: 'domain',
    keywords: [],
    tagOnly: [
      'operations',
      'kpi',
      'kpis',
      'key performance indicators',
      'process improvement',
      'process improvements',
      'continuous improvement',
      'six sigma',
      'lean six sigma',
      'throughput',
      'workflow',
      'workflows',
      'on-time',
    ],
    contextual: {
      lean: {
        needsLine:
          /six sigma|kaizen|\b(?:yellow|green|black) belt|\blean (?:manufacturing|principles|methodolog|practices|operations)/i,
      },
      efficiency: {},
    },
  },
  {
    id: 'logistics',
    name: 'Logistics and shipping',
    category: 'domain',
    keywords: ['supply chain'],
    tagOnly: [
      'logistics',
      'shipping',
      'shipment',
      'shipments',
      'inbound',
      'outbound',
      'freight',
      'warehouse',
      'warehousing',
      'distribution center',
      'fulfillment',
      'dock-to-stock',
      'warehouse management system',
      'transportation management system',
      'wms',
      'tms',
      'edi',
      '3pl',
    ],
    contextual: {
      receiving: { needsLine: /freight|truck|shipment|warehouse|dock|deliver|inventory|stock/i },
      loading: { needsLine: /truck|dock|freight|trailer|warehouse/i },
      transportation: { notBefore: /\b(?:reliable|own|your|public)\s+$/i },
      trucks: {},
      truck: {},
    },
  },
  {
    id: 'scheduling',
    name: 'Scheduling',
    category: 'domain',
    keywords: [],
    tagOnly: [
      'scheduling',
      'shift schedules',
      'staff scheduling',
      'project schedules',
      'timelines',
      'milestones',
      'kronos',
    ],
    contextual: {
      schedule: {
        notBefore:
          /\b(?:flexible|work|working|your|a\s+set|full-time|part-time|weekend|varied|rotating)\s+$/i,
      },
      schedules: { notBefore: /\b(?:flexible|work|working|your)\s+$/i },
      calendar: {},
      calendars: {},
      timeline: {},
      roster: {},
      rosters: {},
    },
  },
  {
    id: 'inventory',
    name: 'Inventory control',
    category: 'domain',
    keywords: ['inventory'],
    tagOnly: [
      'inventory control',
      'inventory management',
      'inventory reconciliation',
      'cycle count',
      'cycle counts',
      'cycle counting',
      'replenishment',
      'item masters',
      'stockroom',
    ],
    contextual: {
      stock: {
        notAfter: /^\s*(?:options?|grants?|purchase|price|awards?|market)\b/i,
      },
      restock: {},
      restocking: {},
      shrink: {},
      reconciliation: { notBefore: /\b(?:bank|account|accounts|financial)\s+$/i },
    },
  },
  {
    id: 'customer-service',
    name: 'Customer service',
    category: 'domain',
    keywords: [],
    tagOnly: [
      'customer service',
      'customer-facing',
      'customer support',
      'escalations',
      'escalation',
      'point of contact',
      'client relationships',
      'account managers',
      'account management',
      'help desk',
      'service desk',
    ],
    contextual: {
      customer: {},
      customers: {},
      client: { notAfter: /^-side/i },
      clients: {},
      complaints: {},
      guest: { notAfter: /^\s+(?:speaker|speakers|lecture|lecturer)\b/i },
      guests: {},
    },
  },
  {
    id: 'process-documentation',
    name: 'Process documentation',
    category: 'domain',
    keywords: [],
    tagOnly: [
      'sop',
      'sops',
      'standard operating procedure',
      'standard operating procedures',
      'process documentation',
      'how-to guide',
      'how-to guides',
      'training materials',
      'work instructions',
      'lessons-learned',
    ],
    contextual: {
      documentation: {},
      procedures: {},
      checklist: {},
      checklists: {},
      manuals: {},
      document: {
        needsAfter: /^\s+(?:processes|process|procedures|steps|workflows?|decisions|changes)\b/i,
      },
    },
  },
  {
    id: 'vendor-coordination',
    name: 'Vendor and carrier coordination',
    category: 'domain',
    keywords: [],
    tagOnly: [
      'vendor',
      'vendors',
      'carrier',
      'carriers',
      'supplier',
      'suppliers',
      'contractors',
      'subcontractors',
      'general contractors',
      'vendor management',
      'procurement',
      'purchase orders',
    ],
    contextual: {
      contractor: {},
    },
  },
  {
    id: 'administrative',
    name: 'Administrative support',
    category: 'domain',
    keywords: [],
    tagOnly: [
      'administrative',
      'data entry',
      'record keeping',
      'recordkeeping',
      'meeting agendas',
      'microsoft office',
      'ms office',
      'google workspace',
      'clerical',
      'front desk',
      'answering phones',
      'action items',
      'meeting notes',
    ],
    contextual: {
      ...SPREADSHEET_RECORDS,
      agendas: {},
      filing: { notAfter: /^\s+(?:taxes|a claim|claims)\b/i },
      correspondence: {},
    },
  },
  {
    id: 'project-coordination',
    name: 'Project coordination',
    category: 'domain',
    keywords: [],
    tagOnly: [
      'project management',
      'project coordination',
      'project plans',
      'project plan',
      'smartsheet',
      'ms project',
      'microsoft project',
      'asana',
      'trello',
      'gantt',
      'capm',
      'pmp',
    ],
    contextual: {
      'project manager': {},
      'project managers': {},
      rollout: {},
      rollouts: {},
      'roll out': {},
    },
  },
  {
    id: 'budgeting',
    name: 'Budgets and costs',
    category: 'domain',
    keywords: [],
    tagOnly: ['budgeting', 'variances', 'payroll', 'labor costs', 'cost control', 'forecasting'],
    contextual: {
      budget: {},
      budgets: {},
      variance: {},
      expenses: {},
      invoices: {},
      invoicing: {},
    },
  },

  // General
  { id: 'general', name: 'General', category: 'general', keywords: [] },
];

/**
 * Context for keywords that live in `keywords` (the posting engine reads
 * them as they are) but mislead the decode screen's tagging on their own.
 * Each rule names the sentence that went wrong.
 */
export const KEYWORD_CONTEXT: Readonly<Record<string, KeywordContext>> = {
  // "prepare weekly reports for leadership": the audience, not the skill.
  leadership: {
    notBefore: /\b(?:for|to|with|from|by|our|senior|company|executive|store|site|regional)\s+$/i,
    notAfter: /^\s+teams?\b/i,
  },
  // "lead time", "team lead", "store lead": a noun, not someone leading.
  lead: {
    notBefore: /\b(?:team|shift|project|store|warehouse|department|tech|technical|key)\s+$/i,
    notAfter: /^\s*(?:times?|generation|gen|-based|paint)\b/i,
  },
  // "a leading provider": a boast about the employer.
  leading: { notBefore: /\b(?:a|an|the|industry|market)[\s-]+$/i },
  // "manage multiple priorities": time, not people.
  manage: { needsAfter: PEOPLE_AFTER },
  // "warehouse management system", "Business Management": not managing people.
  management: {
    needsBefore: /\b(?:people|team|staff|personnel|store|people-)\s*$/i,
  },
  vision: { notAfter: /^\s+(?:insurance|coverage|plan|plans|benefits)\b/i },
  // "pivot tables" is a spreadsheet feature.
  pivot: { notAfter: /^\s*tables?\b/i },
  // "adapt to change", not "change orders" or "change the oil".
  change: {
    needsBefore:
      /\b(?:to|with|through|amid|during|embrace|embraces|navigate|navigating|handle|handling|of|in)\s+$/i,
  },
  // "flexible schedule" is a perk.
  flexible: {
    notAfter: /^\s*(?:schedule|schedules|hours|working|work|pto|time|spending|benefits)\b/i,
  },
  // A vague phrase, not a skill; it counts only beside a real one.
  'fast-paced': { needsLine: /adapt|ambigu|flexib|pivot|changing priorities/i },
  // "be present on site", "at present".
  present: {
    needsAfter:
      /^\s+(?:\w+\s+)?(?:findings|results|data|ideas|updates|information|recommendations|reports?|to)\b/i,
  },
  written: { needsLine: /communicat|english|skills|reports?|documentation/i },
  verbal: { needsLine: /communicat|english|skills/i },
  // "Spring semester".
  spring: { needsLine: /\bjava\b|\bboot\b|framework|\bmvc\b/i },
  // A restaurant server.
  server: { needsLine: /\b(?:api|database|backend|back-end|cloud|linux|code|software|deploy)/i },
  // "responsive to customers".
  responsive: { needsLine: /\b(?:design|web|layout|css|html|site|pages?|ui)\b/i },
  // "mobile pantry", "mobile phone".
  mobile: {
    needsLine: /\b(?:app|apps|application|applications|ios|android|developer|development)\b/i,
  },
  swift: { needsLine: /\b(?:ios|xcode|swiftui|apple|app|apps)\b/i },
  // "react to feedback".
  react: { notAfter: /^\s+(?:to|quickly|calmly)\b/i },
  // "consumer products", "product knowledge" are not product management.
  product: {
    needsAfter:
      /^\s+(?:manager|managers|management|roadmap|sense|thinking|strategy|requirements|development|discovery|owner|team|teams|design)\b/i,
  },
  requirements: {
    needsBefore:
      /\b(?:gather|gathering|define|defining|business|product|user|on|technical|software)\s+$/i,
  },
  // "excel in a fast-paced role" is a verb. "Excel or Google Sheets" on its
  // own is a tool for keeping records; it is data analysis only beside
  // analysis words.
  excel: { notAfter: /^\s+(?:in|at|under)\b/i, needsLine: ANALYSIS_LINE },
  // "job security", "social security".
  security: { notBefore: /\b(?:social|job|financial|food)\s+$/i },
  // "quality of life".
  quality: { notAfter: /^\s+of\s+life\b/i },
  // "mail carrier".
  carrier: { notBefore: /\b(?:mail|letter|baby)\s+$/i },
};

export const SKILL_MAP = new Map(SKILL_BANK.map((s) => [s.id, s]));

export function getSkillName(id: string): string {
  return SKILL_MAP.get(id)?.name ?? id;
}
