/**
 * Reading what someone types into a pay field. People write "62k", "$62,000",
 * "5%" and "26.50"; reading those as 62, 62000, 5 and 26.5 without saying so
 * produces confident wrong answers. Every input is either understood, or
 * refused with a reason.
 */

export type ParsedAmount =
  | { ok: true; value: number | null }
  | { ok: false; value: null; error: string };

export interface AmountOptions {
  /** When set, "5%" means five percent of this yearly figure. */
  percentOf?: number | null;
  min?: number;
  max?: number;
  /** What the number is, for messages: "Hours a week". */
  label?: string;
}

export function parseAmount(input: string, options: AmountOptions = {}): ParsedAmount {
  const text = input.trim();
  if (!text) return { ok: true, value: null };
  const label = options.label ?? 'This';

  const percent = text.match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (percent) {
    if (options.percentOf === undefined) {
      return { ok: false, value: null, error: `${label} needs an amount, not a percentage.` };
    }
    if (options.percentOf === null) {
      return {
        ok: false,
        value: null,
        error: 'A percentage needs the base pay, hours and weeks filled in first.',
      };
    }
    return within((Number(percent[1]) / 100) * options.percentOf, options, label);
  }

  const match = text.replace(/[$,\s]/g, '').match(/^(\d+(?:\.\d+)?)(k|m)?$/i);
  if (!match) {
    return {
      ok: false,
      value: null,
      error: `${label} was not understood. Use a number such as 62000.`,
    };
  }
  const scale =
    match[2]?.toLowerCase() === 'k' ? 1_000 : match[2]?.toLowerCase() === 'm' ? 1_000_000 : 1;
  return within(Number(match[1]) * scale, options, label);
}

function within(value: number, { min, max }: AmountOptions, label: string): ParsedAmount {
  if (!Number.isFinite(value) || value < 0) {
    return { ok: false, value: null, error: `${label} must be zero or more.` };
  }
  if (min !== undefined && value < min) {
    return { ok: false, value: null, error: `${label} must be at least ${min}.` };
  }
  if (max !== undefined && value > max) {
    return { ok: false, value: null, error: `${label} cannot be more than ${max}.` };
  }
  return { ok: true, value };
}
