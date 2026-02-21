import { describe, it, expect } from 'vitest';
import {
  parse24h,
  to12h,
  to24h,
  formatTime,
  isValidHoursInput,
  isValidMinutesInput,
} from '@/lib/utils/time';

describe('parse24h', () => {
  it('parses valid 24h time string', () => {
    expect(parse24h('14:30')).toEqual({ hours: 14, minutes: 30 });
  });

  it('parses midnight', () => {
    expect(parse24h('00:00')).toEqual({ hours: 0, minutes: 0 });
  });

  it('clamps hours to 0-23', () => {
    expect(parse24h('25:00')).toEqual({ hours: 23, minutes: 0 });
    expect(parse24h('-1:00')).toEqual({ hours: 0, minutes: 0 });
  });

  it('clamps minutes to 0-59', () => {
    expect(parse24h('12:65')).toEqual({ hours: 12, minutes: 59 });
  });

  it('handles missing parts', () => {
    expect(parse24h('')).toEqual({ hours: 0, minutes: 0 });
    expect(parse24h('14')).toEqual({ hours: 14, minutes: 0 });
  });

  it('handles NaN values', () => {
    expect(parse24h('abc:def')).toEqual({ hours: 0, minutes: 0 });
  });
});

describe('to12h', () => {
  it('converts 0 hours to 12 AM', () => {
    expect(to12h(0)).toEqual({ hours12: 12, period: 'AM' });
  });

  it('converts 12 hours to 12 PM', () => {
    expect(to12h(12)).toEqual({ hours12: 12, period: 'PM' });
  });

  it('converts afternoon hours', () => {
    expect(to12h(15)).toEqual({ hours12: 3, period: 'PM' });
  });

  it('converts morning hours', () => {
    expect(to12h(9)).toEqual({ hours12: 9, period: 'AM' });
  });
});

describe('to24h', () => {
  it('converts 12 AM to 0', () => {
    expect(to24h(12, 'AM')).toBe(0);
  });

  it('converts 12 PM to 12', () => {
    expect(to24h(12, 'PM')).toBe(12);
  });

  it('converts PM hours', () => {
    expect(to24h(3, 'PM')).toBe(15);
  });

  it('converts AM hours', () => {
    expect(to24h(9, 'AM')).toBe(9);
  });
});

describe('formatTime', () => {
  it('formats with zero padding', () => {
    expect(formatTime(9, 5)).toBe('09:05');
  });

  it('formats double digit values', () => {
    expect(formatTime(14, 30)).toBe('14:30');
  });

  it('formats midnight', () => {
    expect(formatTime(0, 0)).toBe('00:00');
  });
});

describe('isValidHoursInput', () => {
  it('allows empty string', () => {
    expect(isValidHoursInput('', true)).toBe(true);
    expect(isValidHoursInput('', false)).toBe(true);
  });

  it('allows single digits', () => {
    expect(isValidHoursInput('2', true)).toBe(true);
    expect(isValidHoursInput('9', false)).toBe(true);
  });

  it('validates 24h two-digit range', () => {
    expect(isValidHoursInput('23', true)).toBe(true);
    expect(isValidHoursInput('24', true)).toBe(false);
  });

  it('validates 12h two-digit range', () => {
    expect(isValidHoursInput('12', false)).toBe(true);
    expect(isValidHoursInput('13', false)).toBe(false);
    expect(isValidHoursInput('00', false)).toBe(false);
  });

  it('rejects non-numeric input', () => {
    expect(isValidHoursInput('ab', true)).toBe(false);
  });
});

describe('isValidMinutesInput', () => {
  it('allows empty string', () => {
    expect(isValidMinutesInput('')).toBe(true);
  });

  it('allows single digits', () => {
    expect(isValidMinutesInput('5')).toBe(true);
  });

  it('validates two-digit range', () => {
    expect(isValidMinutesInput('59')).toBe(true);
    expect(isValidMinutesInput('60')).toBe(false);
  });

  it('rejects non-numeric input', () => {
    expect(isValidMinutesInput('ab')).toBe(false);
  });
});
