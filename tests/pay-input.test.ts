import { expect, it } from 'vitest';
import { createEmptyDesk, offerEquivalents } from '../src/lib/application-desk';
import { parseAmount } from '../src/lib/pay-input';

it('reads the ways people write money', () => {
  expect(parseAmount('62000')).toEqual({ ok: true, value: 62000 });
  expect(parseAmount('$62,000')).toEqual({ ok: true, value: 62000 });
  expect(parseAmount('62k')).toEqual({ ok: true, value: 62000 });
  expect(parseAmount('26.50')).toEqual({ ok: true, value: 26.5 });
  expect(parseAmount('  ')).toEqual({ ok: true, value: null });
});

it('reads a percentage only where it has something to be a percentage of', () => {
  // The percentage itself is returned too, so the worksheet can keep it.
  expect(parseAmount('5%', { percentOf: 62000 })).toEqual({ ok: true, value: 3100, percent: 5 });
  expect(parseAmount('5%', { percentOf: null })).toMatchObject({ ok: false, value: null });
  expect(parseAmount('5%', { label: 'Hours a week' })).toMatchObject({
    ok: false,
    error: 'Hours a week needs an amount, not a percentage.',
  });
});

it('refuses what it cannot understand, and impossible values', () => {
  expect(parseAmount('about 60')).toMatchObject({ ok: false, value: null });
  expect(parseAmount('200', { max: 100, label: 'Hours a week' })).toMatchObject({
    ok: false,
    error: 'Hours a week cannot be more than 100.',
  });
  expect(parseAmount('60', { max: 52, label: 'Weeks a year' })).toMatchObject({ ok: false });
});

it('counts overtime at time and a half for hourly pay only', () => {
  const base = createEmptyDesk().offer;
  const hourly = offerEquivalents({
    ...base,
    basePay: 26,
    payPeriod: 'hour',
    hoursPerWeek: 40,
    weeksPerYear: 52,
    overtimeHoursPerWeek: 3,
  });
  // 26 x 40 x 52 = 54,080 base; overtime 26 x 1.5 x 3 x 52 = 6,084 is kept
  // apart from it and counted only with the pay that is not promised.
  expect(hourly.annualBase).toBe(54080);
  expect(hourly.overtimeAnnual).toBe(6084);
  expect(hourly.annualGuaranteed).toBe(54080);
  expect(hourly.annualWithVariable).toBe(60164);

  const salaried = offerEquivalents({
    ...base,
    basePay: 62000,
    payPeriod: 'year',
    hoursPerWeek: 45,
    weeksPerYear: 52,
    overtimeHoursPerWeek: 5,
  });
  expect(salaried.annualBase).toBe(62000);
  expect(salaried.overtimeAnnual).toBe(0);
  expect(salaried.hourly).toBeCloseTo(26.5, 2);
});
