import { describe, expect, it } from 'vitest';
import { formatDecimalUnits, parseDecimalUnits } from '@/lib/wealth/decimal';

describe('manual investment decimal conversion', () => {
  it('preserves the smallest supported crypto fraction', () => {
    expect(parseDecimalUnits('0.000000000000000001', 18)).toBe('1');
    expect(formatDecimalUnits('1', 18)).toBe('0.000000000000000001');
  });

  it('converts two-place cash amounts without floating point', () => {
    expect(parseDecimalUnits('100.25', 2)).toBe('10025');
    expect(formatDecimalUnits('10025', 2)).toBe('100.25');
  });

  it('rejects excess precision instead of rounding money', () => {
    expect(() => parseDecimalUnits('100.251', 2)).toThrow('precision');
  });

  it('rejects scientific notation and negative manual amounts', () => {
    expect(() => parseDecimalUnits('1e-8', 18)).toThrow('decimal');
    expect(() => parseDecimalUnits('-1', 2)).toThrow('decimal');
  });
});
