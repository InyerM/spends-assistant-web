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

  it('shows up to 2 decimal places when present', () => {
    const result = formatCurrency(1500.5);
    expect(result).toContain('1.500,5');
  });

  it('omits decimals for whole numbers', () => {
    const result = formatCurrency(1500);
    expect(result).not.toContain(',00');
  });

  it('uses en-US locale when locale is en', () => {
    const result = formatCurrency(1500.75, 'USD', 'en');
    expect(result).toContain('1,500.75');
  });

  it('uses es-CO locale when locale is es', () => {
    const result = formatCurrency(1500.75, 'COP', 'es');
    expect(result).toContain('1.500,75');
  });

  it('uses pt-BR locale when locale is pt', () => {
    const result = formatCurrency(1500.75, 'BRL', 'pt');
    expect(result).toContain('1.500,75');
  });

  it('defaults to es-CO when no locale given', () => {
    const resultDefault = formatCurrency(1000);
    const resultEs = formatCurrency(1000, 'COP', 'es');
    expect(resultDefault).toBe(resultEs);
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
