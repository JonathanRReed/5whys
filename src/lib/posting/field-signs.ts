/**
 * Where a job was, read from its title line. "Cashier, Valley Fresh Market"
 * is retail work even though no line says "retail"; "Store Manager" is too.
 * A posting that asks for "experience in retail, food service, or a
 * warehouse" is answered by the title the person already wrote.
 *
 * Kept narrow on purpose: only the job title and employer line of a role
 * count, never a duty line, and only words that name the kind of workplace
 * or a job that exists only there. Each word matches whole, with a plural,
 * so "market" never matches "marketing". Every verdict this makes can be
 * explained by the one word it found.
 */

/** Words in a title line that place the job in a field. */
export const FIELD_SIGNS: Readonly<Record<string, readonly string[]>> = {
  // Job titles first, so the note quotes the title before the employer's name.
  retail: [
    'retail',
    'cashier',
    'sales associate',
    'key holder',
    'stocker',
    'merchandiser',
    'store',
    'shop',
    'market',
    'grocery',
    'grocer',
    'supermarket',
    'boutique',
    'outlet',
    'pharmacy',
    'sales floor',
  ],
  'food service': [
    'food service',
    'barista',
    'server',
    'waiter',
    'waitress',
    'busser',
    'line cook',
    'prep cook',
    'cook',
    'dishwasher',
    'hostess',
    'host',
    'restaurant',
    'cafe',
    'café',
    'coffee shop',
    'diner',
    'bakery',
    'catering',
    'dining hall',
    'kitchen',
  ],
  warehouse: [
    'warehouse',
    'distribution center',
    'fulfillment center',
    'stockroom',
    'picker',
    'packer',
    'forklift operator',
    'material handler',
  ],
  healthcare: [
    'healthcare',
    'health care',
    'hospital',
    'clinic',
    'medical',
    'nursing',
    'nurse',
    'patient',
    'pharmacy',
    'dental',
    'physician',
    'urgent care',
  ],
  hospitality: ['hospitality', 'hotel', 'resort', 'inn', 'front desk', 'guest services'],
};

/** Second words that name an area of work inside a field: "retail operations", "food service experience". */
const AREA_WORDS = new Set([
  'operations',
  'operation',
  'management',
  'experience',
  'environment',
  'environments',
  'setting',
  'settings',
  'sales',
  'work',
  'industry',
  'store',
  'stores',
]);

const ALIASES: Readonly<Record<string, string>> = {
  'health care': 'healthcare',
  'food services': 'food service',
  'food and beverage': 'food service',
  warehousing: 'warehouse',
  warehouses: 'warehouse',
  restaurant: 'food service',
  restaurants: 'food service',
  hotel: 'hospitality',
};

/**
 * The field a requirement term names, or null: "retail" and "retail
 * operations" name retail; "food service" names food service; "operations"
 * alone names none (almost any job has operations).
 */
export function fieldOf(termKey: string): string | null {
  const key = termKey.toLowerCase().trim();
  const direct = ALIASES[key] ?? key;
  if (FIELD_SIGNS[direct]) return direct;
  const words = key.split(/\s+/);
  if (words.length >= 2 && AREA_WORDS.has(words[words.length - 1])) {
    const head = words.slice(0, -1).join(' ');
    const field = ALIASES[head] ?? head;
    if (FIELD_SIGNS[field]) return field;
  }
  return null;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const signPatterns = new Map<string, RegExp>();

function signPattern(sign: string): RegExp {
  let pattern = signPatterns.get(sign);
  if (!pattern) {
    const words = sign.split(/\s+/).map(escapeRegExp).join('[\\s-]+');
    pattern = new RegExp(`(?<![\\p{L}\\p{N}])${words}(?:s|es)?(?![\\p{L}\\p{N}])`, 'iu');
    signPatterns.set(sign, pattern);
  }
  return pattern;
}

export interface FieldSign {
  field: string;
  /** The word that placed it, as the line wrote it. */
  word: string;
  /** Offsets of that word in the line. */
  start: number;
  end: number;
}

/**
 * Signs that mean something else in some lines: "Market Research Analyst" is
 * not a shop, and a "Server" on an IT team does not wait tables.
 */
const NOT_A_SIGN: Readonly<Record<string, (line: string, after: string) => boolean>> = {
  market: (_line, after) => /^\s*(?:research|analy|data|intelligence|strateg)/i.test(after),
  server: (line) =>
    /\b(?:it|software|systems?|network|cloud|linux|windows|sql|devops|infrastructure|engineer|administrator)\b/i.test(
      line
    ),
  host: (line) => /\b(?:podcast|radio|show|web|hosting)\b/i.test(line),
  store: (_line, after) => /^\s*(?:optimization|front\s+developer)/i.test(after),
};

/** The first word in `titleLine` that places the job in `field`, or null. */
export function fieldSignIn(titleLine: string, field: string): FieldSign | null {
  for (const sign of FIELD_SIGNS[field] ?? []) {
    const found = signPattern(sign).exec(titleLine);
    const after = found ? titleLine.slice(found.index + found[0].length) : '';
    if (found && !NOT_A_SIGN[sign]?.(titleLine, after)) {
      return {
        field,
        word: found[0],
        start: found.index,
        end: found.index + found[0].length,
      };
    }
  }
  return null;
}
