import { describe, it, expect } from 'vitest';
import { buildAccountItems, buildCategoryItems } from '@/lib/utils/select-items';
import { createMockAccount, createMockCategory } from '@/tests/__test-helpers__/factories';

describe('buildAccountItems', () => {
  it('converts accounts to select items', () => {
    const accounts = [
      createMockAccount({ id: 'a1', name: 'Account 1' }),
      createMockAccount({ id: 'a2', name: 'Account 2' }),
    ];
    const items = buildAccountItems(accounts);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ value: 'a1', label: 'Account 1' });
    expect(items[1]).toEqual({ value: 'a2', label: 'Account 2' });
  });

  it('returns empty array for empty input', () => {
    expect(buildAccountItems([])).toEqual([]);
  });
});

describe('buildCategoryItems', () => {
  it('handles flat categories (no children)', () => {
    const categories = [
      createMockCategory({ id: 'c1', name: 'Food', parent_id: null }),
      createMockCategory({ id: 'c2', name: 'Transport', parent_id: null }),
    ];
    const items = buildCategoryItems(categories);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ value: 'c1', label: 'Food' });
  });

  it('groups children under parent', () => {
    const categories = [
      createMockCategory({ id: 'p1', name: 'Food', parent_id: null }),
      createMockCategory({ id: 'c1', name: 'Restaurant', parent_id: 'p1' }),
      createMockCategory({ id: 'c2', name: 'Groceries', parent_id: 'p1' }),
    ];
    const items = buildCategoryItems(categories);
    expect(items).toHaveLength(3); // "All Food" + 2 children
    expect(items[0]).toEqual({ value: 'p1', label: 'All Food', group: 'Food' });
    expect(items[1]).toEqual({ value: 'c1', label: 'Restaurant', group: 'Food' });
  });

  it('filters by type', () => {
    const categories = [
      createMockCategory({ id: 'c1', name: 'Food', type: 'expense', parent_id: null }),
      createMockCategory({ id: 'c2', name: 'Salary', type: 'income', parent_id: null }),
    ];
    const items = buildCategoryItems(categories, 'expense');
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('Food');
  });

  it('includes icon in label', () => {
    const categories = [
      createMockCategory({ id: 'c1', name: 'Food', icon: '🍔', parent_id: null }),
    ];
    const items = buildCategoryItems(categories);
    expect(items[0].label).toBe('🍔 Food');
  });

  it('returns empty array for empty input', () => {
    expect(buildCategoryItems([])).toEqual([]);
  });
});
