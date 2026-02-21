import { describe, it, expect } from 'vitest';
import { detectDelimiter, parseCsvLine, parseCsv } from '@/lib/utils/csv';

describe('detectDelimiter', () => {
  it('detects comma as delimiter when more commas than semicolons', () => {
    expect(detectDelimiter('name,amount,date,type')).toBe(',');
  });

  it('detects semicolon as delimiter when more semicolons than commas', () => {
    expect(detectDelimiter('name;amount;date;type')).toBe(';');
  });

  it('defaults to comma when counts are equal', () => {
    expect(detectDelimiter('name')).toBe(',');
  });

  it('handles mixed delimiters, picks the one with more occurrences', () => {
    expect(detectDelimiter('name;amount;date,type')).toBe(';');
  });
});

describe('parseCsvLine', () => {
  it('splits a simple comma-delimited line', () => {
    expect(parseCsvLine('hello,world,test', ',')).toEqual(['hello', 'world', 'test']);
  });

  it('splits a semicolon-delimited line', () => {
    expect(parseCsvLine('hello;world;test', ';')).toEqual(['hello', 'world', 'test']);
  });

  it('handles quoted fields containing delimiter', () => {
    expect(parseCsvLine('"hello, world",test', ',')).toEqual(['hello, world', 'test']);
  });

  it('handles escaped quotes (double quotes)', () => {
    expect(parseCsvLine('"say ""hello""",test', ',')).toEqual(['say "hello"', 'test']);
  });

  it('trims whitespace from fields', () => {
    expect(parseCsvLine('  hello , world , test ', ',')).toEqual(['hello', 'world', 'test']);
  });

  it('handles empty fields', () => {
    expect(parseCsvLine('a,,c', ',')).toEqual(['a', '', 'c']);
  });

  it('handles a single field', () => {
    expect(parseCsvLine('hello', ',')).toEqual(['hello']);
  });

  it('handles newlines inside quoted fields', () => {
    expect(parseCsvLine('"line1\nline2",test', ',')).toEqual(['line1\nline2', 'test']);
  });
});

describe('parseCsv', () => {
  it('parses a simple CSV with comma delimiter', () => {
    const csv = 'name,amount,date\nAlice,100,2024-01-01\nBob,200,2024-01-02';
    const result = parseCsv(csv);

    expect(result.delimiter).toBe(',');
    expect(result.headers).toEqual(['name', 'amount', 'date']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({ name: 'Alice', amount: '100', date: '2024-01-01' });
    expect(result.rows[1]).toEqual({ name: 'Bob', amount: '200', date: '2024-01-02' });
  });

  it('parses a CSV with semicolon delimiter', () => {
    const csv = 'name;amount;date\nAlice;100;2024-01-01';
    const result = parseCsv(csv);

    expect(result.delimiter).toBe(';');
    expect(result.headers).toEqual(['name', 'amount', 'date']);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({ name: 'Alice', amount: '100', date: '2024-01-01' });
  });

  it('lowercases headers', () => {
    const csv = 'Name,AMOUNT,Date\nAlice,100,2024-01-01';
    const result = parseCsv(csv);

    expect(result.headers).toEqual(['name', 'amount', 'date']);
  });

  it('returns empty result for a CSV with only a header line', () => {
    const csv = 'name,amount,date';
    const result = parseCsv(csv);

    expect(result.headers).toEqual([]);
    expect(result.rows).toEqual([]);
  });

  it('returns empty result for empty input', () => {
    const result = parseCsv('');

    expect(result.headers).toEqual([]);
    expect(result.rows).toEqual([]);
    expect(result.delimiter).toBe(',');
  });

  it('handles rows with fewer values than headers', () => {
    const csv = 'name,amount,date\nAlice,100';
    const result = parseCsv(csv);

    expect(result.rows[0]).toEqual({ name: 'Alice', amount: '100', date: '' });
  });

  it('skips empty lines', () => {
    const csv = 'name,amount\n\nAlice,100\n\nBob,200\n';
    const result = parseCsv(csv);

    expect(result.rows).toHaveLength(2);
  });
});
