/**
 * Reading what someone types into a pay field. People write "62k", "$62,000",
 * "5%" and "26.50"; reading those as 62, 62000, 5 and 26.5 without saying so
 * produces confident wrong answers. Every input is either understood, or
 * refused with a reason.
 */

export type ParsedAmount =
  | {
      ok: true;
      value: number | null;
      /** Set when the input was a percentage: the number before the % sign. */
      percent?: number;
      /**
       * The currency symbol typed with the amount, when it was one other than
       * the dollar sign. Absent for dollars and for a bare number.
       */
      currency?: string;
      /** The top of a range such as "44k to 48k"; `value` is the bottom. */
      to?: number;
    }
  | { ok: false; value: null; error: string };

/** Symbols read as a currency, before or after the number. */
const CURRENCY = /[$€£₹₦¥]/g;

export interface AmountOptions {
  /** When set, "5%" means five percent of this yearly figure. */
  percentOf?: number | null;
  min?: number;
  max?: number;
  /** What the number is, for messages: "Hours a week". */
  label?: string;
  /** False for a field that is not money, such as hours: a currency symbol there is refused. */
  money?: boolean;
  /**
   * What the number counts, when it is not money. "20hrs" and "20 hours a
   * week" are read as 20 in an hours field; "10 wks" as 10 in a weeks field.
   */
  unit?: 'hours' | 'weeks';
  /** The example a message gives, such as "20" for hours. Defaults to 62000. */
  example?: string;
  /**
   * Amounts joined with "+" are added: "35,000 + 40,000 LTIP" is 75,000. A
   * word after an amount names it and is not read.
   */
  sum?: boolean;
  /** "44k to 48k" or "$21-$23" is read as a range: `value` and `to`. */
  range?: boolean;
}

/** Unit words an hours or weeks field accepts after the number. */
const UNIT_WORDS: Record<NonNullable<AmountOptions['unit']>, RegExp> = {
  hours: /\s*(?:h|hr|hrs|hour|hours)\.?(?:\s*(?:a|per|each|\/)\s*(?:week|wk))?\.?$/i,
  weeks: /\s*(?:w|wk|wks|week|weeks)\.?(?:\s*(?:a|per|each|\/)\s*(?:year|yr))?\.?$/i,
};

/** A word or two after an amount that names it: "40,000 LTIP", "5000 signing". */
const AMOUNT_NAME = /\s+(?![km]\b)[a-z][a-z .()/&'-]*$/i;

/** Two amounts joined by "to" or a dash. */
const RANGE = /^(.+?)\s*(?:-|–|—|\bto\b)\s*(.+)$/i;

/**
 * The largest amount the worksheet works with. Past this a number can no
 * longer be held exactly, and multiplying it by hours and weeks can run past
 * what the browser can count at all.
 */
export const LARGEST_AMOUNT = Number.MAX_SAFE_INTEGER;

const SEPARATOR_MESSAGE =
  'was not understood. Use a point for cents, such as 26.50, and commas only between thousands, such as 62,000.';

/**
 * A number as written, with its separators read only when they are
 * unambiguous: commas between groups of three ("62,000", "1,250,000"), or a
 * single comma followed by one or two digits and nothing else ("26,50"), which
 * can only be a decimal comma. Anything else is refused rather than guessed.
 */
function readNumber(text: string, lakh = false): number | 'separator' | 'thousands-point' | null {
  // "62.000" is sixty-two thousand in much of the world and sixty-two in the
  // rest. It is asked about, never guessed.
  if (/^\d{1,3}\.\d{3}$/.test(text)) return 'thousands-point';
  // Two or more points can only separate thousands: "1.250.000".
  if (/^\d{1,3}(\.\d{3}){2,}$/.test(text)) return Number(text.replace(/\./g, ''));
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text);
  if (!text.includes(',')) return null;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) return Number(text.replace(/,/g, ''));
  // Lakh grouping, as written in India, read only with the rupee sign: "₹5,00,000".
  if (lakh && /^\d{1,2}(,\d{2})+,\d{3}(\.\d+)?$/.test(text)) {
    return Number(text.replace(/,/g, ''));
  }
  if (/^\d+,\d{1,2}$/.test(text)) return Number(text.replace(',', '.'));
  return /^[\d.,]+$/.test(text) ? 'separator' : null;
}

export function parseAmount(input: string, options: AmountOptions = {}): ParsedAmount {
  let text = input.trim();
  if (!text) return { ok: true, value: null };
  const label = options.label ?? 'This';
  if (options.unit) text = text.replace(UNIT_WORDS[options.unit], '').trim();
  if (options.range) {
    const range = readRange(text, options);
    if (range) return range;
  }
  if (options.sum && (text.includes('+') || AMOUNT_NAME.test(text))) return readSum(text, options);

  const percent = text.replace(/\s+/g, '').match(/^([\d.,]+)%$/);
  if (percent) {
    if (options.percentOf === undefined) {
      return { ok: false, value: null, error: `${label} needs an amount, not a percentage.` };
    }
    const share = readNumber(percent[1]);
    if (typeof share !== 'number') {
      return { ok: false, value: null, error: `${label} ${SEPARATOR_MESSAGE}` };
    }
    if (options.percentOf === null) {
      return {
        ok: false,
        value: null,
        error: 'A percentage needs the base pay, hours and weeks filled in first.',
      };
    }
    const result = within((share / 100) * options.percentOf, options, label);
    return result.ok ? { ...result, percent: share } : result;
  }

  const symbols = [...new Set(text.match(CURRENCY) ?? [])];
  if (symbols.length > 1) {
    return { ok: false, value: null, error: `${label} has more than one currency in it.` };
  }
  if (symbols.length === 1 && options.money === false) {
    return { ok: false, value: null, error: `${label} is a number, not an amount of money.` };
  }
  const match = text
    .replace(CURRENCY, '')
    .replace(/\s/g, '')
    .match(/^([\d.,]+)(k|m)?$/i);
  const number = match ? readNumber(match[1], symbols[0] === '₹') : null;
  if (number === 'separator') {
    return { ok: false, value: null, error: `${label} ${SEPARATOR_MESSAGE}` };
  }
  if (number === 'thousands-point' && match) {
    const digits = match[1];
    return {
      ok: false,
      value: null,
      error: `Did you mean ${digits.replace('.', ',')} or ${Number(digits)}? Write ${digits.replace('.', '')} for the first, or ${Number(digits)} for the second.`,
    };
  }
  if (!match || typeof number !== 'number') {
    return {
      ok: false,
      value: null,
      error: `${label} was not understood. Use a number such as ${options.example ?? '62000'}.`,
    };
  }
  const scale =
    match[2]?.toLowerCase() === 'k' ? 1_000 : match[2]?.toLowerCase() === 'm' ? 1_000_000 : 1;
  const result = within(number * scale, options, label);
  return result.ok && symbols[0] && symbols[0] !== '$'
    ? { ...result, currency: symbols[0] }
    : result;
}

/**
 * Amounts joined with "+", each of which may be followed by a name. A
 * percentage cannot be added this way: it is a share of something else.
 */
function readSum(text: string, options: AmountOptions): ParsedAmount {
  const label = options.label ?? 'This';
  const terms = text.split('+').map((term) => term.trim());
  if (terms.some((term) => !term)) {
    return {
      ok: false,
      value: null,
      error: `${label} has a "+" with nothing on one side of it. Write it as 35000 + 40000.`,
    };
  }
  if (terms.length === 1) {
    return parseAmount(terms[0].replace(AMOUNT_NAME, '').trim(), { ...options, sum: false });
  }
  let total = 0;
  let currency: string | undefined;
  for (const term of terms) {
    const bare = term.replace(AMOUNT_NAME, '').trim();
    if (bare.includes('%')) {
      return {
        ok: false,
        value: null,
        error: `${label} can add amounts with "+", but not percentages. Write each part as an amount.`,
      };
    }
    const part = parseAmount(bare, { ...options, sum: false, range: false });
    if (!part.ok) return part;
    if (part.value === null) {
      return {
        ok: false,
        value: null,
        error: `${label} was not understood. Use a number such as ${options.example ?? '62000'}.`,
      };
    }
    if (currency !== undefined && (part.currency ?? '$') !== currency) {
      return { ok: false, value: null, error: `${label} has more than one currency in it.` };
    }
    currency = part.currency ?? '$';
    total += part.value;
  }
  const result = within(total, options, label);
  return result.ok && currency && currency !== '$' ? { ...result, currency } : result;
}

/**
 * "44k to 48k", "$44,000 - $48,000" or "$21-23": the bottom and the top. A
 * "k" written only on the top ("44-48k") is read on both. Null when the text
 * is not two amounts, so it is read as one amount instead.
 */
function readRange(text: string, options: AmountOptions): ParsedAmount | null {
  const match = text.match(RANGE);
  if (!match) return null;
  const label = options.label ?? 'This';
  let [, lowText, highText] = match;
  const scale = highText.trim().match(/(k|m)$/i)?.[1];
  if (scale && /^[^a-z]*\d$/i.test(lowText.trim()) && !/[.,]\d{3}/.test(lowText)) {
    const bare = parseAmount(lowText, { ...options, range: false });
    const top = parseAmount(highText, { ...options, range: false });
    if (
      bare.ok &&
      top.ok &&
      bare.value !== null &&
      top.value !== null &&
      bare.value * 1000 <= top.value
    ) {
      lowText = `${lowText.trim()}${scale}`;
    }
  }
  const low = parseAmount(lowText, { ...options, range: false });
  const high = parseAmount(highText, { ...options, range: false });
  if (!low.ok || !high.ok || low.value === null || high.value === null) return null;
  if ((low.currency ?? '$') !== (high.currency ?? '$')) {
    return { ok: false, value: null, error: `${label} has more than one currency in it.` };
  }
  if (high.value <= low.value) {
    return {
      ok: false,
      value: null,
      error: `${label} reads as a range, but the second number is not the larger. Write the lower one first, such as 44000 to 48000.`,
    };
  }
  return low.currency
    ? { ok: true, value: low.value, to: high.value, currency: low.currency }
    : { ok: true, value: low.value, to: high.value };
}

function within(value: number, { min, max }: AmountOptions, label: string): ParsedAmount {
  if (!Number.isFinite(value) || value < 0) {
    return { ok: false, value: null, error: `${label} must be zero or more.` };
  }
  if (value > LARGEST_AMOUNT) {
    return { ok: false, value: null, error: `${label} is too large to work out.` };
  }
  if (min !== undefined && value < min) {
    return { ok: false, value: null, error: `${label} must be at least ${min}.` };
  }
  if (max !== undefined && value > max) {
    return { ok: false, value: null, error: `${label} cannot be more than ${max}.` };
  }
  return { ok: true, value };
}
