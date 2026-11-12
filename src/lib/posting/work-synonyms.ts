/**
 * Common work, said different ways. A store says "truck" where a logistics
 * posting says "shipment"; a campus job says "shift plan" where an office
 * says "schedule". These groups only power the "this line may already say
 * it, in other words" prompt (near-miss.ts). They never count as evidence,
 * and they never suggest a word for work the person did not do: the prompt
 * asks whether it is the same work before offering the posting's words.
 *
 * Each word is matched on word boundaries with plural, -ing, and -ed forms.
 * A word written in capitals ("DC") only matches in capitals.
 *
 * `thing` groups name objects of work (freight, schedules, invoices);
 * `action` groups name what is done to them (train, reconcile). A near miss
 * needs at least one thing in common, never just a verb.
 */

export interface WorkSynonymGroup {
  id: string;
  kind: 'thing' | 'action';
  words: readonly string[];
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
    words: [
      'inventory',
      'stock',
      'cycle count',
      'stock count',
      'inventory count',
      'restock',
      'replenishment',
      'sku',
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
    words: ['purchase order', 'purchasing', 'procurement', 'ordering', 'reorder', 'requisition'],
  },

  // Scheduling, staffing, and people
  {
    id: 'schedule',
    kind: 'thing',
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
    words: ['train', 'coach', 'onboard', 'orient', 'mentor', 'teach new hires'],
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
    words: ['associate', 'employee', 'crew', 'staff member', 'team member', 'worker'],
  },
  { id: 'volunteer', kind: 'thing', words: ['volunteer', 'volunteers', 'volunteer shift'] },

  // Customers and service
  {
    id: 'customer',
    kind: 'thing',
    words: ['customer', 'client', 'guest', 'patron', 'shopper', 'visitor', 'caller'],
  },
  {
    id: 'escalation',
    kind: 'thing',
    words: ['escalation', 'complaint', 'dispute', 'service issue'],
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
  { id: 'appointment', kind: 'thing', words: ['appointment', 'booking', 'reservation', 'sign-up'] },

  // Retail and money
  {
    id: 'cash',
    kind: 'thing',
    words: ['cash', 'register', 'till', 'pos', 'point of sale', 'payment', 'transaction'],
  },
  { id: 'sales', kind: 'thing', words: ['sales', 'revenue', 'upsell', 'sales plan', 'sales goal'] },
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
    words: ['rollout', 'roll out', 'launch', 'implementation', 'go-live', 'conversion', 'pilot'],
  },
  { id: 'loss', kind: 'thing', words: ['shrink', 'loss prevention', 'theft', 'waste'] },
  {
    id: 'budget',
    kind: 'thing',
    words: ['budget', 'payroll', 'labor cost', 'spend', 'expense', 'p&l', 'cost'],
  },
  {
    id: 'invoice',
    kind: 'thing',
    words: ['invoice', 'billing', 'accounts payable', 'accounts receivable'],
  },
  { id: 'kpi', kind: 'thing', words: ['kpi', 'metric', 'scorecard', 'benchmark'] },

  // Office and records
  {
    id: 'report',
    kind: 'thing',
    words: ['report', 'summary', 'dashboard', 'recap', 'status update', 'tracker'],
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
    words: ['records', 'filing', 'paperwork', 'documentation', 'log', 'logbook'],
  },
  {
    id: 'procedure',
    kind: 'thing',
    words: ['sop', 'procedure', 'checklist', 'how-to guide', 'playbook', 'process document'],
  },
  {
    id: 'meeting',
    kind: 'thing',
    words: ['meeting', 'agenda', 'huddle', 'standup', 'briefing', 'minutes'],
  },
  { id: 'notes', kind: 'thing', words: ['notes', 'action items', 'follow-up'] },
  {
    id: 'deadline',
    kind: 'thing',
    words: ['milestone', 'deadline', 'timeline', 'due date', 'target date'],
  },
  {
    id: 'improve',
    kind: 'action',
    words: ['process improvement', 'streamline', 'efficiency', 'workflow', 'standardize'],
  },
  {
    id: 'audit',
    kind: 'thing',
    words: ['audit', 'inspection', 'walk-through', 'compliance check', 'quality check'],
  },
  { id: 'safety', kind: 'thing', words: ['safety', 'osha', 'compliance', 'incident', 'hazard'] },
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
];
