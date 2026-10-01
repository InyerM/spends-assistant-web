import { describe, expect, it } from 'vitest';
import {
  formatDecimalUnits,
  formatLocalizedDecimalUnits,
  parseDecimalUnits,
} from '@/lib/wealth/decimal';

describe('manual investment decimal conversion', () => {
  it('preserves the smallest supported crypto fraction', () => {
    expect(parseDecimalUnits('0.000000000000000001', 18)).toBe('1');
    expect(formatDecimalUnits('1', 18)).toBe('0.000000000000000001');
  });

  it('converts two-place cash amounts without floating point', () => {
    expect(parseDecimalUnits('100.25', 2)).toBe('10025');
    expect(formatDecimalUnits('10025', 2)).toBe('100.25');
  });

  it('keeps whole COP units unchanged when the scale is zero', () => {
    expect(parseDecimalUnits('12000', 0)).toBe('12000');
    expect(formatDecimalUnits('12000', 0)).toBe('12000');
  });

  it('groups large values for the selected locale without losing crypto precision', () => {
    expect(formatLocalizedDecimalUnits('3015000', 0, 'es-CO')).toBe('3.015.000');
    expect(formatLocalizedDecimalUnits('123456789', 8, 'en-US')).toBe('1.23456789');
    expect(formatLocalizedDecimalUnits('123456789', 8, 'es-CO')).toBe('1,23456789');
  });

  it('rejects excess precision instead of rounding money', () => {
    expect(() => parseDecimalUnits('100.251', 2)).toThrow('precision');
  });

  it('rejects scientific notation and negative manual amounts', () => {
    expect(() => parseDecimalUnits('1e-8', 18)).toThrow('decimal');
    expect(() => parseDecimalUnits('-1', 2)).toThrow('decimal');
  });
});
