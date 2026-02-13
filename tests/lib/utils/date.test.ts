import { describe, it, expect } from 'vitest';
import {
  getCurrentColombiaTimes,
  formatDateForDisplay,
  formatTimeForDisplay,
} from '@/lib/utils/date';

describe('getCurrentColombiaTimes', () => {
  it('returns date in YYYY-MM-DD format', () => {
    const { date } = getCurrentColombiaTimes();
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns time in HH:mm:ss format', () => {
    const { time } = getCurrentColombiaTimes();
    expect(time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('returns datetime combining date and time', () => {
    const { date, time, datetime } = getCurrentColombiaTimes();
    expect(datetime).toBe(`${date}T${time}`);
  });
});

describe('formatDateForDisplay', () => {
  it('formats ISO date as human-readable', () => {
    const result = formatDateForDisplay('2024-01-15');
    expect(result).toBe('Jan 15, 2024');
  });

  it('returns original string for invalid date', () => {
    const result = formatDateForDisplay('not-a-date');
    expect(result).toBe('not-a-date');
  });

  it('formats different months correctly', () => {
    expect(formatDateForDisplay('2024-06-01')).toBe('Jun 1, 2024');
    expect(formatDateForDisplay('2024-12-25')).toBe('Dec 25, 2024');
  });
});

describe('formatTimeForDisplay', () => {
  it('formats PM time', () => {
    expect(formatTimeForDisplay('14:30')).toBe('2:30 PM');
  });

  it('formats AM time', () => {
    expect(formatTimeForDisplay('09:15')).toBe('9:15 AM');
  });

  it('formats noon as 12 PM', () => {
    expect(formatTimeForDisplay('12:00')).toBe('12:00 PM');
  });

  it('formats midnight as 12 AM', () => {
    expect(formatTimeForDisplay('00:00')).toBe('12:00 AM');
  });
});
