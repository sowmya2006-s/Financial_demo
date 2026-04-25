// tests/unit/domain/cohort.test.ts
// Tests for pure cohort domain functions.
// No mocks needed — these are pure functions with no dependencies.

import { getISOWeekKey, isValidWeekKey } from '../../../src/domain/cohort';

describe('getISOWeekKey', () => {
  it('returns the correct ISO week key for a known date', () => {
    // Monday 6 Jan 2025 = Week 2 of 2025 (ISO)
    const date = new Date('2025-01-06T10:00:00Z');
    expect(getISOWeekKey(date)).toBe('2025-W02');
  });

  it('returns the same week key for any day within the same ISO week', () => {
    // Mon–Sun of the same ISO week should all map to the same key
    const monday = new Date('2025-03-03T00:00:00Z');
    const wednesday = new Date('2025-03-05T12:00:00Z');
    const sunday = new Date('2025-03-09T23:59:59Z');

    expect(getISOWeekKey(monday)).toBe(getISOWeekKey(wednesday));
    expect(getISOWeekKey(monday)).toBe(getISOWeekKey(sunday));
  });

  it('returns different week keys for dates in different ISO weeks', () => {
    const week3 = new Date('2025-01-13T00:00:00Z');
    const week4 = new Date('2025-01-20T00:00:00Z');

    expect(getISOWeekKey(week3)).not.toBe(getISOWeekKey(week4));
  });

  it('handles ISO week year boundary correctly (late December → next year)', () => {
    // 2025-12-29 is in ISO week 1 of 2026
    const date = new Date('2025-12-29T00:00:00Z');
    expect(getISOWeekKey(date)).toBe('2026-W01');
  });

  it('handles ISO week year boundary correctly (early January → previous year)', () => {
    // 2025-01-01 is in ISO week 1 of 2025
    const date = new Date('2025-01-01T00:00:00Z');
    expect(getISOWeekKey(date)).toBe('2025-W01');
  });

  it('is deterministic — same input always produces the same output', () => {
    const date = new Date('2025-06-15T08:30:00Z');
    const result1 = getISOWeekKey(date);
    const result2 = getISOWeekKey(date);
    expect(result1).toBe(result2);
  });

  it('does not mutate the input date', () => {
    const date = new Date('2025-06-15T08:30:00Z');
    const originalTime = date.getTime();
    getISOWeekKey(date);
    expect(date.getTime()).toBe(originalTime);
  });

  it('produces a string matching the YYYY-Www format', () => {
    const date = new Date('2025-06-15T00:00:00Z');
    const key = getISOWeekKey(date);
    expect(key).toMatch(/^\d{4}-W\d{2}$/);
  });
});

describe('isValidWeekKey', () => {
  it('returns true for valid week keys', () => {
    expect(isValidWeekKey('2025-W01')).toBe(true);
    expect(isValidWeekKey('2025-W52')).toBe(true);
    expect(isValidWeekKey('2026-W10')).toBe(true);
  });

  it('returns false for malformed keys', () => {
    expect(isValidWeekKey('2025-W00')).toBe(false); // week 0 doesn't exist
    expect(isValidWeekKey('2025-W54')).toBe(false); // max is W53
    expect(isValidWeekKey('25-W03')).toBe(false);   // year too short
    expect(isValidWeekKey('2025-03')).toBe(false);  // missing W prefix
    expect(isValidWeekKey('')).toBe(false);
  });
});
