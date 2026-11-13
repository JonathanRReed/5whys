/**
 * Common work, said different ways. A store says "truck" where a logistics
 * posting says "shipment"; a campus job says "shift plan" where an office
 * says "schedule". These groups only power the "this line may already say
 * it, in other words" prompt (near-miss.ts). They never count as evidence,
 * and they never suggest a word for work the person did not do: the prompt
 * asks whether it is the same work before offering the posting's words.
 *
 * Each word is matched on word boundaries with plural, -ing, and -ed forms.
 * A noun ending in -ing is written in the plural ("meetings") so both
 * forms match. A word written in capitals ("DC") only matches in capitals.
 *
 * `thing` groups name objects of work (freight, schedules, invoices);
 * `action` groups name what is done to them (train, reconcile). A near miss
 * needs at least one thing in common, never just a verb.
 *
 * A word may sit in more than one group ("vendor" is a carrier and a
 * stakeholder). A group marked `alone` names a kind of work specific enough
 * that one shared concept, said in other words, may be the same work: a
 * rollout and a go-live, a food cost and a budget, a safety meeting and a
 * status meeting. Every other group needs a second concept in common, since
 * sharing an object (freight, customers, staff) does not make two jobs the
 * same work.
 */

export interface WorkSynonymGroup {
  id: string;
  kind: 'thing' | 'action';
  words: readonly string[];
  /** Specific enough to suggest the same work on its own. */
  alone?: boolean;
}

export const WORK_SYNONYM_GROUPS: readonly WorkSynonymGroup[] = [
  // Warehouse, freight, and logistics
  {
    id: 'shipment',
    kind: 'thing',
    words: [
      'shipment',
      'shipping',
      'freight',
      'truck',
      'delivery',
      'inbound',
      'outbound',
      'cargo',
      'parcel',
    ],
  },
  {
    id: 'warehouse',
    kind: 'thing',
    words: [
      'warehouse',
      'distribution center',
      'DC',
      'stockroom',
      'backroom',
      'back room',
      'dock',
      'fulfillment center',
    ],
  },
  {
    id: 'receiving',
    kind: 'action',
    words: ['receiving', 'receive', 'unload', 'putaway', 'check in freight'],
  },
  {
    id: 'carrier',
    kind: 'thing',
    alone: true,
    words: ['carrier', 'vendor', 'supplier', 'distributor', 'trucking company'],
  },
  {
    id: 'pick-pack',
    kind: 'action',
    words: ['pick', 'pack', 'order fulfillment', 'fulfillment', 'kitting'],
  },
  {
    id: 'dispatch',
    kind: 'thing',
    words: ['dispatch', 'route', 'routing', 'driver', 'delivery route'],
  },
  {
    id: 'logistics',
    kind: 'thing',
    words: ['logistics', 'supply chain', 'freight flow', 'transportation'],
  },
  {
    id: 'inventory',
    kind: 'thing',
    alone: true,
    words: [
      'inventory',
      'stock',
      'cycle count',
      'stock count',
      'inventory count',
      'restock',
      'replenishment',
      'sku',
      'hand receipt',
      'property book',
      'supplies',
      'supply room',
      'equipment accountability',
    ],
  },
  {
    id: 'reconcile',
    kind: 'action',
    words: [
      'reconcile',
      'reconciliation',
      'discrepancy',
      'variance',
      'mismatch',
      'shortage',
      'overage',
    ],
  },
  {
    id: 'equipment',
    kind: 'thing',
    words: ['forklift', 'pallet jack', 'scanner', 'handheld', 'rf gun'],
  },
  { id: 'returns', kind: 'thing', words: ['return', 'refund', 'exchange', 'rma', 'damaged goods'] },
  {
    id: 'purchasing',
    kind: 'thing',
    alone: true,
    words: ['purchase order', 'purchasing', 'procurement', 'ordering', 'reorder', 'requisition'],
  },

  // Scheduling, staffing, and people
  {
    id: 'schedule',
    kind: 'thing',
    alone: true,
    words: ['schedule', 'roster', 'shift plan', 'rota', 'timetable', 'calendar', 'staffing plan'],
  },
  {
    id: 'labor',
    kind: 'thing',
    words: ['labor', 'staffing', 'payroll hours', 'shift coverage', 'headcount'],
  },
  {
    id: 'train',
    kind: 'action',
    words: [
      'train',
      'coach',
      'onboard',
      'orient',
      'mentor',
      'teach new hires',
      'onboarding',
      'orientation',
      'cross-train',
      'teach',
      'taught',
      'instruct',
      'new hire trainings',
    ],
  },
  { id: 'hire', kind: 'action', words: ['hire', 'recruit', 'interview candidates', 'staff up'] },
  {
    id: 'supervise',
    kind: 'action',
    words: [
      'supervise',
      'oversee staff',
      'shift lead',
      'key holder',
      'team lead',
      'crew lead',
      'department lead',
    ],
  },
  {
    id: 'staff',
    kind: 'thing',
    words: [
      'associate',
      'employee',
      'crew',
      'staff member',
      'team member',
      'worker',
      'new hire',
      'frontline staff',
      'picker',
      'packer',
      'soldier',
      'personnel',
      'troops',
      'caregiver',
      'aide',
      'server',
    ],
  },
  {
    id: 'volunteer',
    kind: 'thing',
    words: ['volunteer', 'volunteers', 'volunteer shift'],
  },

  // Customers and service
  {
    id: 'customer',
    kind: 'thing',
    words: [
      'customer',
      'client',
      'guest',
      'patron',
      'shopper',
      'visitor',
      'caller',
      'patient',
      'resident',
      'family member',
    ],
  },
  {
    id: 'escalation',
    kind: 'thing',
    words: ['escalation', 'complaint', 'dispute', 'service issue', 'problem', 'grievance'],
  },
  { id: 'resolve', kind: 'action', words: ['resolve', 'resolution', 'solve'] },
  {
    id: 'phone',
    kind: 'thing',
    words: ['phone', 'call', 'email', 'voicemail', 'inquiry', 'ticket'],
  },
  {
    id: 'service-desk',
    kind: 'thing',
    words: ['help desk', 'service desk', 'support desk', 'call center', 'customer service'],
  },
  {
    id: 'front-desk',
    kind: 'thing',
    words: ['front desk', 'reception', 'welcome desk', 'check-in', 'lobby'],
  },
  { id: 'greet', kind: 'action', words: ['greet', 'welcome guests', 'host'] },
  {
    id: 'appointment',
    kind: 'thing',
    words: ['appointment', 'bookings', 'reservation', 'sign-up'],
  },

  // Retail and money
  {
    id: 'cash',
    kind: 'thing',
    words: ['cash', 'register', 'till', 'pos', 'point of sale', 'payment', 'transaction'],
  },
  { id: 'sales', kind: 'thing', words: ['sales', 'revenue', 'upsell', 'sales plan', 'sales goal'] },
  // Work where the numbers have to come out right: a drawer counted at close,
  // a tally, totals. Specific enough that one of them may be the same work as
  // "attention to detail with numbers".
  {
    id: 'figures',
    kind: 'thing',
    alone: true,
    words: ['numbers', 'figures', 'totals', 'tally', 'drawer', 'cash count', 'count the drawer'],
  },
  {
    id: 'merchandising',
    kind: 'thing',
    words: ['merchandise', 'display', 'planogram', 'signage', 'floor set', 'endcap'],
  },
  {
    id: 'remodel',
    kind: 'thing',
    words: ['remodel', 'renovation', 'reset', 'refresh', 'buildout', 'fixture', 'store opening'],
  },
  {
    id: 'rollout',
    kind: 'thing',
    alone: true,
    words: [
      'rollout',
      'roll out',
      'launch',
      'implementation',
      'go-live',
      'conversion',
      'pilot',
      'go live',
      'cutover',
      'changeover',
      'new system',
      'system upgrade',
    ],
  },
  { id: 'loss', kind: 'thing', words: ['shrink', 'loss prevention', 'theft', 'waste'] },
  {
    id: 'budget',
    kind: 'thing',
    alone: true,
    words: [
      'budget',
      'payroll',
      'labor cost',
      'spend',
      'expense',
      'p&l',
      'cost',
      'food cost',
      'cost of goods',
      'operating budget',
      'spending',
    ],
  },
  {
    id: 'invoice',
    kind: 'thing',
    alone: true,
    words: ['invoice', 'billing', 'accounts payable', 'accounts receivable'],
  },
  { id: 'kpi', kind: 'thing', alone: true, words: ['kpi', 'metric', 'scorecard', 'benchmark'] },

  // Office and records
  {
    id: 'report',
    kind: 'thing',
    words: [
      'report',
      'summary',
      'dashboard',
      'recap',
      'status update',
      'tracker',
      'status report',
      'end-of-day report',
      'shift report',
      'handoff report',
      'progress report',
    ],
  },
  {
    id: 'spreadsheet',
    kind: 'thing',
    words: ['spreadsheet', 'excel', 'google sheets', 'workbook'],
  },
  {
    id: 'data-entry',
    kind: 'action',
    words: ['data entry', 'enter data', 'key in', 'input', 'record keeping'],
  },
  {
    id: 'records',
    kind: 'thing',
    words: [
      'records',
      'receipts',
      'filing',
      'paperwork',
      'documentation',
      'log',
      'logbook',
      'chart',
      'charting',
      'care notes',
      'incident log',
    ],
  },
  {
    id: 'procedure',
    kind: 'thing',
    alone: true,
    words: ['sop', 'procedure', 'checklist', 'how-to guide', 'playbook', 'process document'],
  },
  {
    id: 'meeting',
    kind: 'thing',
    alone: true,
    words: [
      'meetings',
      'agenda',
      'huddle',
      'standup',
      'briefings',
      'minutes',
      'status meetings',
      'safety meetings',
      'shift meetings',
      'staff meetings',
      'team meetings',
      'pre-shift meetings',
      'toolbox talk',
      'stand-ups',
      'line-ups',
      'pre-shift',
    ],
  },
  { id: 'notes', kind: 'thing', words: ['notes', 'action items', 'follow-up'] },
  {
    id: 'deadline',
    kind: 'thing',
    alone: true,
    words: [
      'milestone',
      'deadline',
      'timeline',
      'due date',
      'target date',
      'cutoff',
      'go-live date',
      'launch date',
    ],
  },
  {
    id: 'improve',
    kind: 'action',
    words: ['process improvement', 'streamline', 'efficiency', 'workflow', 'standardize'],
  },
  {
    id: 'audit',
    kind: 'thing',
    alone: true,
    words: ['audit', 'inspection', 'walk-through', 'compliance check', 'quality check'],
  },
  {
    id: 'safety',
    kind: 'thing',
    alone: true,
    words: [
      'safety',
      'osha',
      'compliance',
      'incident',
      'hazard',
      'regulatory',
      'infection control',
      'incident report',
      'safety meetings',
    ],
  },
  {
    id: 'contractor',
    kind: 'thing',
    words: ['contractor', 'subcontractor', 'installer', 'technician', 'facilities'],
  },
  { id: 'install', kind: 'action', words: ['install', 'installation', 'set up', 'setup', 'mount'] },
  {
    id: 'vendor-relations',
    kind: 'thing',
    words: ['vendor relations', 'supplier relations', 'vendor returns', 'vendor visits'],
  },

  // Food service
  {
    id: 'food-prep',
    kind: 'action',
    words: ['food prep', 'food preparation', 'prep', 'cook', 'line cook', 'kitchen'],
  },
  {
    id: 'food-safety',
    kind: 'thing',
    words: ['food safety', 'servsafe', 'sanitation', 'food handler', 'health code'],
  },
  {
    id: 'serve',
    kind: 'action',
    words: ['wait tables', 'server', 'bartend', 'barista', 'serve guests'],
  },
  {
    id: 'clean',
    kind: 'action',
    words: ['clean', 'sanitize', 'janitorial', 'tidy', 'closing duties'],
  },

  // Campus, nonprofit, and volunteer work
  {
    id: 'event',
    kind: 'thing',
    alone: true,
    words: ['event', 'workshop', 'fundraiser', 'open house', 'orientation', 'program night'],
  },
  {
    id: 'outreach',
    kind: 'thing',
    words: ['outreach', 'promotion', 'flyer', 'campaign', 'social media', 'newsletter'],
  },
  {
    id: 'fundraising',
    kind: 'thing',
    words: ['fundraising', 'donation', 'donor', 'sponsorship', 'grant'],
  },
  { id: 'tutor', kind: 'action', words: ['tutor', 'teach', 'instruct', 'lesson', 'study session'] },
  {
    id: 'tour',
    kind: 'thing',
    words: ['tour', 'campus tour', 'walkthrough', 'orientation session'],
  },
  {
    id: 'research',
    kind: 'thing',
    words: ['research', 'survey', 'literature review', 'experiment'],
  },
  {
    id: 'analysis',
    kind: 'action',
    words: ['analyze', 'analysis', 'trend', 'forecast', 'sales history'],
  },
  { id: 'present', kind: 'action', words: ['present', 'presentation', 'slide deck'] },
  { id: 'write', kind: 'action', words: ['write', 'draft', 'edit', 'proofread', 'copywriting'] },
  { id: 'design', kind: 'thing', words: ['design', 'layout', 'graphic', 'canva', 'mockup'] },
  {
    id: 'mentor',
    kind: 'action',
    words: ['advise', 'peer advisor', 'resident assistant', 'counsel'],
  },
  // People a project answers to, in any setting
  {
    id: 'stakeholder',
    kind: 'thing',
    words: [
      'stakeholder',
      'client',
      'vendor',
      'carrier',
      'supplier',
      'partner',
      'department head',
      'community partner',
    ],
  },
  {
    id: 'project',
    kind: 'thing',
    words: ['project', 'mission', 'initiative', 'launch'],
  },

  // Teaching
  {
    id: 'curriculum',
    kind: 'thing',
    alone: true,
    words: [
      'curriculum',
      'lesson plan',
      'unit plan',
      'syllabus',
      'training material',
      'course material',
      'training guide',
      'job aid',
      'learning module',
    ],
  },
  {
    id: 'assessment',
    kind: 'thing',
    alone: true,
    words: [
      'assessment',
      'grading',
      'rubric',
      'evaluation',
      'performance review',
      'progress report',
      'observation',
    ],
  },

  // Caregiving and health
  {
    id: 'care-plan',
    kind: 'thing',
    alone: true,
    words: [
      'care plan',
      'treatment plan',
      'service plan',
      'case plan',
      'IEP',
      'individualized plan',
      'support plan',
    ],
  },
  {
    id: 'intake',
    kind: 'thing',
    words: ['intake', 'admission', 'registration', 'check-in'],
  },
];
