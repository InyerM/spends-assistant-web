import { describe, it, expect } from 'vitest';
import { findById, findNameById } from '@/lib/utils/lookup';

describe('findById', () => {
  const items = [
    { id: '1', name: 'Alice', extra: true },
    { id: '2', name: 'Bob', extra: false },
    { id: '3', name: 'Charlie', extra: true },
  ];

  it('finds an item by id', () => {
    expect(findById(items, '2')).toEqual({ id: '2', name: 'Bob', extra: false });
  });

  it('returns undefined for a non-existent id', () => {
    expect(findById(items, '99')).toBeUndefined();
  });

  it('returns undefined for an empty array', () => {
    expect(findById([], '1')).toBeUndefined();
  });
});

describe('findNameById', () => {
  const items = [
    { id: '1', name: 'Alice' },
    { id: '2', name: 'Bob' },
    { id: '3', name: 'Charlie' },
  ];

  it('returns the name for a matching id', () => {
    expect(findNameById(items, '1')).toBe('Alice');
  });

  it('returns empty string for a non-existent id', () => {
    expect(findNameById(items, '99')).toBe('');
  });

  it('returns empty string for an empty array', () => {
    expect(findNameById([], '1')).toBe('');
  });

  it('returns the correct name for different items', () => {
    expect(findNameById(items, '3')).toBe('Charlie');
  });
});
