import { describe, it, expect } from 'vitest';
import { formatCurrency, capitalize } from '@/lib/utils/formatting';

describe('formatCurrency', () => {
  it('formats COP by default', () => {
    const result = formatCurrency(50000);
    expect(result).toContain('50');
  });

  it('formats zero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0');
  });

  it('accepts USD currency', () => {
    const result = formatCurrency(100, 'USD');
    expect(result).toContain('100');
  });
});

describe('capitalize', () => {
  it('capitalizes first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
  });

  it('lowercases rest of string', () => {
    expect(capitalize('HELLO')).toBe('Hello');
  });

  it('returns empty string for empty input', () => {
    expect(capitalize('')).toBe('');
  });
});
