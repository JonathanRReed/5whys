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
    }
  | { ok: false; value: null; error: string };

export interface AmountOptions {
  /** When set, "5%" means five percent of this yearly figure. */
  percentOf?: number | null;
  min?: number;
  max?: number;
  /** What the number is, for messages: "Hours a week". */
  label?: string;
}

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
function readNumber(text: string): number | 'separator' | null {
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text);
  if (!text.includes(',')) return null;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) return Number(text.replace(/,/g, ''));
  if (/^\d+,\d{1,2}$/.test(text)) return Number(text.replace(',', '.'));
  return /^[\d.,]+$/.test(text) ? 'separator' : null;
}

export function parseAmount(input: string, options: AmountOptions = {}): ParsedAmount {
  const text = input.trim();
  if (!text) return { ok: true, value: null };
  const label = options.label ?? 'This';

  const percent = text.replace(/\s+/g, '').match(/^([\d.,]+)%$/);
  if (percent) {
    if (options.percentOf === undefined) {
      return { ok: false, value: null, error: `${label} needs an amount, not a percentage.` };
    }
    const share = readNumber(percent[1]);
    if (share === 'separator' || share === null) {
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

  const match = text.replace(/[$\s]/g, '').match(/^([\d.,]+)(k|m)?$/i);
  const number = match ? readNumber(match[1]) : null;
  if (number === 'separator') {
    return { ok: false, value: null, error: `${label} ${SEPARATOR_MESSAGE}` };
  }
  if (!match || number === null) {
    return {
      ok: false,
      value: null,
      error: `${label} was not understood. Use a number such as 62000.`,
    };
  }
  const scale =
    match[2]?.toLowerCase() === 'k' ? 1_000 : match[2]?.toLowerCase() === 'm' ? 1_000_000 : 1;
  return within(number * scale, options, label);
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
