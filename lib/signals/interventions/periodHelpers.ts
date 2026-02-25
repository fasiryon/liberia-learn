/**
 * Shared period-range helpers for intervention engine.
 * Re-exports from impactEngine where possible to avoid duplication.
 */

export function isValidPeriod(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export function parseMonthStart(yyyyMm: string): Date {
  const [y, m] = yyyyMm.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
}

export function parseMonthEnd(yyyyMm: string): Date {
  const [y, m] = yyyyMm.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1, 0, 0, 0, 0) - 1);
}
