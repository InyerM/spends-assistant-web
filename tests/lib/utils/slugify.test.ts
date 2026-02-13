import { describe, it, expect } from 'vitest';
import { slugify } from '@/lib/utils/slugify';

describe('slugify', () => {
  it('converts spaces to dashes', () => {
    expect(slugify('hello world')).toBe('hello-world');
  });

  it('removes accents', () => {
    expect(slugify('café résumé')).toBe('cafe-resume');
  });

  it('removes leading and trailing dashes', () => {
    expect(slugify('  hello  ')).toBe('hello');
  });

  it('converts special chars to dashes', () => {
    expect(slugify('hello!@#world')).toBe('hello-world');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('lowercases all characters', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });
});
