/**
 * Plain student wording mapped to the professional terms for the same work.
 *
 * Rules for every entry:
 * - The terms describe the work in the phrase and nothing bigger. "Helped
 *   with the rollout" never becomes "led the rollout".
 * - No software or tool names (nothing from HARD_SKILLS), no numbers, no
 *   capitals, so the rules tier passes the same invented-claim check a model
 *   does.
 * - `honestUse` says when the words fit, in the student's register.
 *
 * Entries are ordered specific first; the first two that match are used.
 */
export type WordingEntry = {
  id: string;
  match: RegExp;
  terms: readonly string[];
  honestUse: string;
};

export const WORDING_DICTIONARY: readonly WordingEntry[] = [
  {
    id: 'rollout',
    match:
      /\b(?:help(?:ed)?|assist(?:ed)?|support(?:ed)?|work(?:ed)? on)\b.*\b(?:roll ?out|launch|switch(?:over)?|transition|go-live|new system)\b/i,
    terms: ['adoption', 'cross-functional coordination', 'implementation support'],
    honestUse:
      'Use these if you helped people start using something new. They do not say you planned it.',
  },
  {
    id: 'trained-on-system',
    match:
      /\b(?:train(?:ed|ing)?|taught|show(?:ed|n)|walk(?:ed)?)\b.*\b(?:system|software|tool|app|process|register|platform|everyone|staff|new hires|volunteers|coworkers)\b/i,
    terms: ['training', 'change adoption', 'onboarding'],
    honestUse: 'Use these if you taught people how to use it, not only used it yourself.',
  },
  {
    id: 'ran-meetings',
    match: /\b(?:ran|led|chaired|run|running|facilitated)\b.*\bmeetings?\b/i,
    terms: ['meeting facilitation', 'agenda planning', 'group coordination'],
    honestUse: 'Use agenda planning only if you set what the meeting covered.',
  },
  {
    id: 'social-media',
    match:
      /\b(?:instagram|tiktok|social media|socials|twitter|facebook|snapchat|threads|linkedin page)\b|\bclub'?s? (?:account|page)\b/i,
    terms: ['social media management', 'content planning', 'audience growth'],
    honestUse:
      'Use audience growth only if the following grew while you posted. The other two fit if you planned and posted the content.',
  },
  {
    id: 'video',
    match: /\b(?:videos?|filmed|filming|vlogs?|reels?|youtube channel)\b/i,
    terms: ['video production', 'content creation', 'storytelling'],
    honestUse: 'Use these if you shot or put together the videos yourself.',
  },
  {
    id: 'posters',
    match: /\b(?:posters?|flyers?|fliers?|graphics?|banners?|infographics?)\b/i,
    terms: ['graphic design', 'event promotion', 'visual communication'],
    honestUse: 'Use graphic design if you made the designs, not only printed or hung them.',
  },
  {
    id: 'newsletter',
    match: /\b(?:newsletters?|email blasts?|mailing list|listserv)\b/i,
    terms: ['email marketing', 'content writing', 'internal communications'],
    honestUse: 'Use these if you wrote or put together what went out.',
  },
  {
    id: 'student-paper',
    match:
      /\b(?:student (?:paper|newspaper|magazine)|wrote (?:articles|stories|posts)|blog(?:ged)?|journalism|reporter)\b/i,
    terms: ['content writing', 'editorial work', 'research and interviewing'],
    honestUse: 'Use research and interviewing only if you talked to sources for your pieces.',
  },
  {
    id: 'editing',
    match: /\b(?:edit(?:ed|ing)?|proofread(?:ing)?|proof-read|copyedit(?:ed|ing)?)\b/i,
    terms: ['editing', 'proofreading', 'quality review'],
    honestUse: 'Use these for writing you checked and corrected for someone else or a group.',
  },
  {
    id: 'front-desk',
    match:
      /\b(?:front desk|reception(?:ist)?|answer(?:ed|ing)? (?:the )?phones?|phone calls|greet(?:ed|ing))\b/i,
    terms: ['front office operations', 'customer service', 'visitor support'],
    honestUse: 'Use these if greeting people and answering questions was part of the job.',
  },
  {
    id: 'upset-customers',
    match:
      /\b(?:angry|upset|difficult|rude|unhappy|frustrated)\b.*\b(?:customers?|clients?|guests?|people|parents?|patrons?|callers?)\b|\bcomplaints?\b/i,
    terms: ['customer issue resolution', 'de-escalation', 'customer service'],
    honestUse: 'Use de-escalation if you calmed people down yourself, not only passed them on.',
  },
  {
    id: 'register',
    match: /\b(?:cash register|register|cashier|till|checkout|point of sale)\b/i,
    terms: ['point of sale operations', 'cash handling', 'transaction accuracy'],
    honestUse: 'Use cash handling if you took payments and balanced the drawer.',
  },
  {
    id: 'counted-inventory',
    match: /\bcount(?:ed|ing)?\b.*\b(?:inventory|stock|supplies)\b/i,
    terms: ['inventory tracking', 'stock auditing', 'record keeping'],
    honestUse: 'Use these if you counted and recorded what was on hand.',
  },
  {
    id: 'stocked-shelves',
    match:
      /\b(?:stock(?:ed|ing)? (?:the )?shelves|restock(?:ed|ing)?|stockroom|unloaded (?:the )?truck|inventory)\b/i,
    terms: ['stock replenishment', 'merchandising', 'inventory support'],
    honestUse: 'Use merchandising if you also arranged how products were displayed.',
  },
  {
    id: 'waited-tables',
    match:
      /\b(?:waited tables|waitress|waiter|served (?:tables|food|customers)|bussed tables|barista|hostess)\b/i,
    terms: ['customer service', 'order accuracy', 'working under time pressure'],
    honestUse: 'These fit any shift where you took and delivered orders.',
  },
  {
    id: 'kitchen',
    match: /\b(?:line cook|prep cook|cook(?:ed|ing)?|kitchen)\b/i,
    terms: ['food preparation', 'food safety', 'kitchen operations'],
    honestUse: 'Use food safety if you followed handling and storage rules on the job.',
  },
  {
    id: 'delivery',
    match: /\b(?:deliver(?:ed|ies|y|ing)|delivery driver|drove for|courier)\b/i,
    terms: ['route planning', 'time management', 'customer service'],
    honestUse: 'Use route planning if you chose your own routes or order of stops.',
  },
  {
    id: 'selling',
    match:
      /\b(?:sold|selling|resold|reselling|etsy|ebay|depop|my own (?:business|shop)|side hustle|mowed lawns|lawn care)\b/i,
    terms: ['sales', 'small business operations', 'customer relationships'],
    honestUse: 'Use small business operations if you handled pricing, orders, or money yourself.',
  },
  {
    id: 'tutoring',
    match:
      /\b(?:tutor(?:ed|ing)?|helped (?:my )?(?:classmates|students|kids)|study groups?|homework help)\b/i,
    terms: ['tutoring', 'peer instruction', 'academic support'],
    honestUse: 'These fit if you explained material to other students.',
  },
  {
    id: 'grading',
    match: /\b(?:grad(?:ed|ing)|teaching assistant|office hours)\b|\bTA\b/,
    terms: ['assessment', 'instructional support', 'student feedback'],
    honestUse: 'Use student feedback if you wrote comments on the work, not only marks.',
  },
  {
    id: 'mentoring',
    match: /\b(?:mentor(?:ed|ing)?|big (?:brother|sister)|buddy program|peer advisor)\b/i,
    terms: ['mentoring', 'peer advising', 'student support'],
    honestUse: 'These fit if someone came to you regularly for advice.',
  },
  {
    id: 'childcare',
    match: /\b(?:babysit(?:ting)?|babysat|nann(?:y|ied)|camp counselor|childcare|daycare)\b/i,
    terms: ['childcare', 'youth supervision', 'safety awareness'],
    honestUse: 'These fit any time you were responsible for kids on your own.',
  },
  {
    id: 'coaching',
    match: /\b(?:coach(?:ed|ing)?|referee(?:d)?|umpire(?:d)?|swim lessons?|taught lessons)\b/i,
    terms: ['coaching', 'youth development', 'instruction'],
    honestUse: 'Use youth development if you worked with the same kids over a season or more.',
  },
  {
    id: 'event',
    match:
      /\b(?:plan(?:ned)?|organi[sz]ed?|put together|set up|threw|hosted)\b.*\b(?:events?|party|fundraiser|trip|workshops?|tournament|gala|fair|night|show|concert)\b/i,
    terms: ['event planning', 'logistics coordination', 'scheduling'],
    honestUse: 'Use event planning if you decided the details, not only showed up to help.',
  },
  {
    id: 'fundraising',
    match: /\b(?:raised|raising|fundrais(?:er|ing)|bake sale|donations?|car wash|pledges?)\b/i,
    terms: ['fundraising', 'donor outreach', 'event promotion'],
    honestUse: 'Use donor outreach if you asked people or businesses for money yourself.',
  },
  {
    id: 'treasurer',
    match: /\b(?:treasurer|budget|dues|reimburse(?:d|ments?)?|receipts|expenses)\b/i,
    terms: ['budget tracking', 'financial record keeping', 'expense reconciliation'],
    honestUse: 'Use these if you kept the records of money in and out.',
  },
  {
    id: 'notes',
    match: /\b(?:took (?:the )?notes|minutes|secretary|note[- ]?taker)\b/i,
    terms: ['record keeping', 'meeting minutes', 'internal communications'],
    honestUse: 'Use internal communications if you also sent the notes out to the group.',
  },
  {
    id: 'recruiting',
    match: /\b(?:recruit(?:ed|ing)?|got (?:new )?members|signed (?:people )?up|tabl(?:ed|ing))\b/i,
    terms: ['member recruitment', 'outreach', 'community engagement'],
    honestUse: 'These fit if you talked to people to bring them in.',
  },
  {
    id: 'outreach',
    match: /\b(?:emailed|reached out|cold[- ]emailed|contacted|messaged|called)\b/i,
    terms: ['outreach', 'stakeholder communication', 'relationship building'],
    honestUse: 'Use relationship building if you kept in touch after the first message.',
  },
  {
    id: 'onboarding',
    match:
      /\b(?:new (?:members|hires|employees|volunteers|students)|orientation|showed (?:them|people|new \w+) around|welcom(?:ed|ing))\b/i,
    terms: ['onboarding', 'peer mentoring', 'orientation'],
    honestUse: 'These fit if you helped new people find their footing.',
  },
  {
    id: 'website',
    match: /\b(?:website|web ?page|landing page|site for)\b/i,
    terms: ['web content management', 'site updates', 'user-facing content'],
    honestUse: 'Use these if you changed or wrote what was on the site.',
  },
  {
    id: 'coding',
    match:
      /\b(?:cod(?:ed|ing)|programm(?:ed|ing)|built an? (?:app|game|bot|program|tool)|wrote (?:a )?(?:script|program))\b/i,
    terms: ['software development', 'prototyping', 'debugging'],
    honestUse: 'These fit code you wrote yourself, for class or on your own.',
  },
  {
    id: 'tech-help',
    match:
      /\b(?:fix(?:ed|ing)? (?:computers|laptops|printers|the wifi|tech)|tech support|help ?desk|it help)\b/i,
    terms: ['technical support', 'troubleshooting', 'user support'],
    honestUse: 'These fit if people came to you when something stopped working.',
  },
  {
    id: 'tracking',
    match: /\b(?:spreadsheet|tracker|kept track|tracked|logged)\b/i,
    terms: ['data tracking', 'record keeping', 'reporting'],
    honestUse: 'Use reporting if you shared what you tracked with someone who used it.',
  },
  {
    id: 'scheduling',
    match: /\b(?:schedul(?:e|es|ed|ing)|shifts?|calendar|rota)\b/i,
    terms: ['scheduling', 'shift coordination', 'resource planning'],
    honestUse: 'Use these if you made the schedule, not only worked from it.',
  },
  {
    id: 'surveys',
    match:
      /\b(?:surveys?|surveyed|asked (?:people|students|customers|members|users)|feedback forms?|poll(?:ed|s)?|interviewed)\b/i,
    terms: ['feedback collection', 'needs assessment', 'stakeholder input'],
    honestUse: 'These fit if you gathered what people thought and did something with it.',
  },
  {
    id: 'lab',
    match:
      /\b(?:lab|laboratory|experiments?|research assistant|research project|ran (?:samples|tests))\b/i,
    terms: ['research support', 'data collection', 'experimental procedure'],
    honestUse: 'Use data collection if you recorded the results yourself.',
  },
  {
    id: 'analysis',
    match:
      /\b(?:analy[sz](?:ed|ing|is)|data from|crunch(?:ed)? (?:the )?numbers|statistics|stats)\b/i,
    terms: ['data analysis', 'quantitative analysis', 'findings reporting'],
    honestUse: 'Use findings reporting if you wrote up or presented what the data showed.',
  },
  {
    id: 'presenting',
    match: /\b(?:present(?:ed|ing|ation)s?|gave a talk|spoke (?:at|to)|pitch(?:ed)?)\b/i,
    terms: ['public speaking', 'presentation', 'communicating findings'],
    honestUse: 'These fit any time you explained work to a room.',
  },
  {
    id: 'volunteering',
    match:
      /\b(?:food (?:bank|pantry)|shelter|soup kitchen|community garden|volunteer(?:ed|ing)?)\b/i,
    terms: ['community service', 'nonprofit operations support', 'service delivery'],
    honestUse: 'These fit regular volunteer work with an organization.',
  },
  {
    id: 'officer',
    match: /\b(?:president|vice president|captain|officer|chair(?:person)?|head of)\b/i,
    terms: ['student leadership', 'team coordination', 'decision making'],
    honestUse: 'These fit a role people elected or chose you for.',
  },
  {
    id: 'group-project',
    match:
      /\b(?:group project|team project|worked with (?:my )?(?:team|group|classmates)|teammates)\b/i,
    terms: ['collaboration', 'team coordination', 'shared deliverables'],
    honestUse: 'Use team coordination if you kept the group on track, not only did your part.',
  },
  {
    id: 'caught-errors',
    match:
      /\b(?:caught|spotted|found|fixed|noticed)\b.*\b(?:errors?|mistakes?|typos?|bugs?|wrong)\b/i,
    terms: ['quality control', 'error checking', 'attention to detail'],
    honestUse: 'These fit if you found problems before they reached someone else.',
  },
  {
    id: 'better-way',
    match:
      /\b(?:better way|faster way|easier|made it (?:faster|easier|simpler)|streamlin(?:ed|ing)|cut down|sped up|shortcut|automat(?:ed|ing))\b/i,
    terms: ['process improvement', 'workflow efficiency', 'problem solving'],
    honestUse: 'These fit if the change you made is still how it is done.',
  },
  {
    id: 'admin',
    match:
      /\b(?:fil(?:ed|ing)|paperwork|data entry|typed up|entered (?:data|records|info)|administrative|office work)\b/i,
    terms: ['data entry', 'records management', 'administrative support'],
    honestUse: 'These fit routine office work you did on your own.',
  },
  {
    id: 'translating',
    match: /\b(?:translat(?:e|ed|ing)|interpret(?:ed|ing)|bilingual)\b/i,
    terms: ['interpretation', 'multilingual communication', 'cultural liaison'],
    honestUse: 'Use interpretation if you translated live between people.',
  },
  {
    id: 'caregiving',
    match:
      /\b(?:took care of|caregiver|caring for|care for)\b.*\b(?:grand\w*|mom|dad|mother|father|parents?|siblings?|brother|sister|family)\b/i,
    terms: ['caregiving', 'household management', 'time management'],
    honestUse: 'These fit regular care you gave while keeping up with school or work.',
  },
];

/** Words too general to link a posting term to the work. */
export const GENERIC_WORDS: ReadonlySet<string> = new Set([
  'and',
  'the',
  'for',
  'with',
  'skills',
  'skill',
  'experience',
  'ability',
  'strong',
  'excellent',
  'work',
  'working',
  'management',
  'support',
  'operations',
  'communication',
  'communications',
  'team',
  'teams',
  'good',
  'great',
  'proven',
  'knowledge',
]);
