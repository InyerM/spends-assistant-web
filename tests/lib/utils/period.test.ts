import { describe, it, expect } from 'vitest';
import {
  detectMode,
  getLabel,
  getMonthNames,
  getMonthShort,
  getDayHeaders,
  toStr,
  toDate,
  getPrevPeriod,
  getNextPeriod,
} from '@/lib/utils/period';

describe('toStr', () => {
  it('formats Date to YYYY-MM-DD string', () => {
    expect(toStr(new Date(2024, 0, 15))).toBe('2024-01-15');
  });

  it('pads single-digit month and day', () => {
    expect(toStr(new Date(2024, 2, 5))).toBe('2024-03-05');
  });
});

describe('toDate', () => {
  it('parses YYYY-MM-DD string to Date', () => {
    const d = toDate('2024-06-15');
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(5); // June = 5
    expect(d.getDate()).toBe(15);
  });

  it('handles January correctly (month 0)', () => {
    const d = toDate('2024-01-01');
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });
});

describe('detectMode', () => {
  it('detects full year range as year mode', () => {
    expect(detectMode('2024-01-01', '2024-12-31')).toBe('year');
  });

  it('detects first to last day of month as month mode', () => {
    expect(detectMode('2024-06-01', '2024-06-30')).toBe('month');
    expect(detectMode('2024-02-01', '2024-02-29')).toBe('month'); // 2024 is leap year
  });

  it('detects Monday-to-Sunday range as week mode', () => {
    // 2024-01-01 is a Monday
    expect(detectMode('2024-01-01', '2024-01-07')).toBe('week');
  });

  it('returns custom for arbitrary ranges', () => {
    expect(detectMode('2024-01-15', '2024-02-20')).toBe('custom');
  });

  it('returns custom for partial month', () => {
    expect(detectMode('2024-06-05', '2024-06-30')).toBe('custom');
  });
});

describe('getLabel', () => {
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const monthShort = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  it('returns month + year for month mode', () => {
    expect(getLabel('2024-06-01', '2024-06-30', 'month', monthNames, monthShort)).toBe('June 2024');
  });

  it('returns year string for year mode', () => {
    expect(getLabel('2024-01-01', '2024-12-31', 'year', monthNames, monthShort)).toBe('2024');
  });

  it('returns custom range for custom mode', () => {
    const label = getLabel('2024-01-15', '2024-02-20', 'custom', monthNames, monthShort);
    expect(label).toContain('Jan');
    expect(label).toContain('Feb');
    expect(label).toContain('15');
    expect(label).toContain('20');
  });

  it('returns week label for week mode', () => {
    const label = getLabel('2024-01-01', '2024-01-07', 'week', monthNames, monthShort);
    expect(label).toContain('W1');
    expect(label).toContain('Jan');
  });
});

describe('getMonthNames', () => {
  it('returns 12 month names in English', () => {
    const names = getMonthNames('en');
    expect(names).toHaveLength(12);
    expect(names[0]).toBe('January');
    expect(names[11]).toBe('December');
  });

  it('returns 12 month names in Spanish', () => {
    const names = getMonthNames('es');
    expect(names).toHaveLength(12);
    // First letter capitalized
    expect(names[0].charAt(0)).toBe(names[0].charAt(0).toUpperCase());
  });
});

describe('getMonthShort', () => {
  it('returns 12 abbreviated month names', () => {
    const names = getMonthShort('en');
    expect(names).toHaveLength(12);
    expect(names[0]).toBe('Jan');
    expect(names[11]).toBe('Dec');
  });
});

describe('getDayHeaders', () => {
  it('returns 7 day names', () => {
    const headers = getDayHeaders('en');
    expect(headers).toHaveLength(7);
  });
});

describe('getPrevPeriod', () => {
  it('returns previous month for month mode', () => {
    expect(getPrevPeriod('2024-06-01', 'month')).toEqual(['2024-05-01', '2024-05-31']);
  });

  it('returns previous week for week mode', () => {
    expect(getPrevPeriod('2024-01-08', 'week')).toEqual(['2024-01-01', '2024-01-07']);
  });

  it('returns previous year for year mode', () => {
    expect(getPrevPeriod('2024-01-01', 'year')).toEqual(['2023-01-01', '2023-12-31']);
  });

  it('returns null for custom mode', () => {
    expect(getPrevPeriod('2024-01-15', 'custom')).toBeNull();
  });
});

describe('getNextPeriod', () => {
  it('returns next month for month mode', () => {
    expect(getNextPeriod('2024-06-01', 'month')).toEqual(['2024-07-01', '2024-07-31']);
  });

  it('returns next week for week mode', () => {
    expect(getNextPeriod('2024-01-01', 'week')).toEqual(['2024-01-08', '2024-01-14']);
  });

  it('returns next year for year mode', () => {
    expect(getNextPeriod('2024-01-01', 'year')).toEqual(['2025-01-01', '2025-12-31']);
  });

  it('returns null for custom mode', () => {
    expect(getNextPeriod('2024-01-15', 'custom')).toBeNull();
  });
});
