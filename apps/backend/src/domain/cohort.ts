// src/domain/cohort.ts
// Pure functions for cohort assignment logic.
// NO database access. NO side effects. Fully deterministic and unit-testable.

/**
 * Derives the ISO week key (e.g. "2025-W03") from a given date.
 * All users registering in the same ISO calendar week share the same cohort.
 *
 * ISO 8601 week: week starts on Monday, week 1 = week containing first Thursday of year.
 */
export function getISOWeekKey(date: Date): string {
  // Work with a UTC-safe copy to avoid mutating the input and avoid local timezone drift.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

  // Adjust to nearest Thursday (ISO week year is determined by where Thursday falls)
  const dayOfWeek = d.getUTCDay() || 7; // convert Sunday (0) to 7
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);

  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const year = d.getUTCFullYear();

  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
}

/**
 * Validates that a weekKey string has the expected format.
 * Used defensively when reading weekKeys from external input.
 */
export function isValidWeekKey(weekKey: string): boolean {
  return /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(weekKey);
}
