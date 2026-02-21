import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTransactionFilters } from '@/hooks/use-transaction-filters';
import type { TransactionFilters } from '@/types';
import type { Account } from '@/types';
import type { Category } from '@/types';

type ListFilters = Omit<TransactionFilters, 'page' | 'limit'>;

const ACCOUNTS: Account[] = [
  {
    id: 'a1',
    user_id: 'u1',
    name: 'Checking',
    type: 'checking',
    institution: null,
    last_four: null,
    currency: 'COP',
    balance: 1000,
    is_active: true,
    color: null,
    icon: null,
    deleted_at: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
  {
    id: 'a2',
    user_id: 'u1',
    name: 'Savings',
    type: 'savings',
    institution: null,
    last_four: null,
    currency: 'COP',
    balance: 5000,
    is_active: true,
    color: null,
    icon: null,
    deleted_at: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
];

const CATEGORIES: Category[] = [
  {
    id: 'c1',
    user_id: 'u1',
    name: 'Food',
    slug: 'food',
    type: 'expense',
    parent_id: null,
    icon: null,
    color: null,
    is_active: true,
    created_at: '2024-01-01',
  },
  {
    id: 'c2',
    user_id: 'u1',
    name: 'Restaurants',
    slug: 'restaurants',
    type: 'expense',
    parent_id: 'c1',
    icon: null,
    color: null,
    is_active: true,
    created_at: '2024-01-01',
  },
  {
    id: 'c3',
    user_id: 'u1',
    name: 'Groceries',
    slug: 'groceries',
    type: 'expense',
    parent_id: 'c1',
    icon: null,
    color: null,
    is_active: true,
    created_at: '2024-01-01',
  },
  {
    id: 'c4',
    user_id: 'u1',
    name: 'Transport',
    slug: 'transport',
    type: 'expense',
    parent_id: null,
    icon: null,
    color: null,
    is_active: true,
    created_at: '2024-01-01',
  },
];

describe('useTransactionFilters', () => {
  const baseFilters: ListFilters = {};

  function renderFiltersHook(
    filters: ListFilters = baseFilters,
    accounts: Account[] = ACCOUNTS,
    categories: Category[] = CATEGORIES,
  ) {
    const onFiltersChange = vi.fn();
    const result = renderHook(() =>
      useTransactionFilters({
        filters,
        onFiltersChange,
        accounts,
        categories,
      }),
    );
    return { ...result, onFiltersChange };
  }

  describe('toggleType', () => {
    it('adds a type when not selected', () => {
      const { result, onFiltersChange } = renderFiltersHook();
      act(() => result.current.toggleType('expense'));
      expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ types: ['expense'] }));
    });

    it('removes a type when already selected', () => {
      const { result, onFiltersChange } = renderFiltersHook({ types: ['expense', 'income'] });
      act(() => result.current.toggleType('expense'));
      expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ types: ['income'] }));
    });

    it('clears types when last type is removed', () => {
      const { result, onFiltersChange } = renderFiltersHook({ types: ['expense'] });
      act(() => result.current.toggleType('expense'));
      expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ types: undefined }));
    });
  });

  describe('toggleAllTypes', () => {
    it('selects all types when none are selected', () => {
      const { result, onFiltersChange } = renderFiltersHook();
      act(() => result.current.toggleAllTypes());
      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({ types: ['expense', 'income', 'transfer'] }),
      );
    });

    it('deselects all types when all are selected', () => {
      const { result, onFiltersChange } = renderFiltersHook({
        types: ['expense', 'income', 'transfer'],
      });
      act(() => result.current.toggleAllTypes());
      expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ types: undefined }));
    });
  });

  describe('toggleAccount', () => {
    it('adds an account when not selected', () => {
      const { result, onFiltersChange } = renderFiltersHook();
      act(() => result.current.toggleAccount('a1'));
      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({ account_ids: ['a1'] }),
      );
    });

    it('removes an account when already selected', () => {
      const { result, onFiltersChange } = renderFiltersHook({ account_ids: ['a1', 'a2'] });
      act(() => result.current.toggleAccount('a1'));
      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({ account_ids: ['a2'] }),
      );
    });

    it('clears account_ids when last account is removed', () => {
      const { result, onFiltersChange } = renderFiltersHook({ account_ids: ['a1'] });
      act(() => result.current.toggleAccount('a1'));
      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({ account_ids: undefined }),
      );
    });
  });

  describe('toggleAllAccounts', () => {
    it('selects all accounts when none are selected', () => {
      const { result, onFiltersChange } = renderFiltersHook();
      act(() => result.current.toggleAllAccounts());
      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({ account_ids: ['a1', 'a2'] }),
      );
    });

    it('deselects all accounts when all are selected', () => {
      const { result, onFiltersChange } = renderFiltersHook({ account_ids: ['a1', 'a2'] });
      act(() => result.current.toggleAllAccounts());
      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({ account_ids: undefined }),
      );
    });

    it('does nothing when accounts is undefined', () => {
      const onFiltersChange = vi.fn();
      const { result } = renderHook(() =>
        useTransactionFilters({
          filters: baseFilters,
          onFiltersChange,
          accounts: undefined,
          categories: CATEGORIES,
        }),
      );
      act(() => result.current.toggleAllAccounts());
      expect(onFiltersChange).not.toHaveBeenCalled();
    });
  });

  describe('toggleCategory (parent with children)', () => {
    it('selects parent and all children when parent is not selected', () => {
      const { result, onFiltersChange } = renderFiltersHook();
      act(() => result.current.toggleCategory('c1'));
      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({ category_ids: ['c1', 'c2', 'c3'] }),
      );
    });

    it('deselects parent and all children when parent is selected', () => {
      const { result, onFiltersChange } = renderFiltersHook({
        category_ids: ['c1', 'c2', 'c3'],
      });
      act(() => result.current.toggleCategory('c1'));
      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({ category_ids: undefined }),
      );
    });

    it('handles parent with no children', () => {
      const { result, onFiltersChange } = renderFiltersHook();
      act(() => result.current.toggleCategory('c4'));
      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({ category_ids: ['c4'] }),
      );
    });
  });

  describe('toggleSubcategory', () => {
    it('adds a subcategory when not selected', () => {
      const { result, onFiltersChange } = renderFiltersHook();
      act(() => result.current.toggleSubcategory('c2', 'c1'));
      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({ category_ids: ['c2'] }),
      );
    });

    it('selects parent when all siblings become selected', () => {
      const { result, onFiltersChange } = renderFiltersHook({ category_ids: ['c2'] });
      act(() => result.current.toggleSubcategory('c3', 'c1'));
      // Both children c2, c3 selected + parent c1
      const call = onFiltersChange.mock.calls[0][0] as ListFilters;
      expect(call.category_ids).toContain('c1');
      expect(call.category_ids).toContain('c2');
      expect(call.category_ids).toContain('c3');
    });

    it('removes subcategory and deselects parent', () => {
      const { result, onFiltersChange } = renderFiltersHook({
        category_ids: ['c1', 'c2', 'c3'],
      });
      act(() => result.current.toggleSubcategory('c2', 'c1'));
      const call = onFiltersChange.mock.calls[0][0] as ListFilters;
      expect(call.category_ids).toContain('c3');
      expect(call.category_ids).not.toContain('c2');
      expect(call.category_ids).not.toContain('c1');
    });
  });

  describe('toggleAllCategories', () => {
    it('selects all category ids when none selected', () => {
      const { result, onFiltersChange } = renderFiltersHook();
      act(() => result.current.toggleAllCategories());
      const call = onFiltersChange.mock.calls[0][0] as ListFilters;
      expect(call.category_ids).toHaveLength(4);
      expect(call.category_ids).toEqual(['c1', 'c2', 'c3', 'c4']);
    });

    it('deselects all when all are selected', () => {
      const { result, onFiltersChange } = renderFiltersHook({
        category_ids: ['c1', 'c2', 'c3', 'c4'],
      });
      act(() => result.current.toggleAllCategories());
      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({ category_ids: undefined }),
      );
    });

    it('does nothing when categories is undefined', () => {
      const onFiltersChange = vi.fn();
      const { result } = renderHook(() =>
        useTransactionFilters({
          filters: baseFilters,
          onFiltersChange,
          accounts: ACCOUNTS,
          categories: undefined,
        }),
      );
      act(() => result.current.toggleAllCategories());
      expect(onFiltersChange).not.toHaveBeenCalled();
    });
  });

  describe('activeFilterCount', () => {
    it('returns 0 when no filters are active', () => {
      const { result } = renderFiltersHook();
      expect(result.current.activeFilterCount).toBe(0);
    });

    it('counts search filter', () => {
      const { result } = renderFiltersHook({ search: 'test' });
      expect(result.current.activeFilterCount).toBe(1);
    });

    it('counts multiple active filters', () => {
      const { result } = renderFiltersHook({
        search: 'test',
        types: ['expense'],
        account_ids: ['a1'],
        category_ids: ['c1'],
        sort_by: 'amount',
      });
      expect(result.current.activeFilterCount).toBe(5);
    });
  });

  describe('handleSort', () => {
    it('sets sort when non-default', () => {
      const { result, onFiltersChange } = renderFiltersHook();
      act(() => result.current.handleSort('amount-desc'));
      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({ sort_by: 'amount', sort_order: 'desc' }),
      );
    });

    it('clears sort when selecting default (date-desc)', () => {
      const { result, onFiltersChange } = renderFiltersHook({
        sort_by: 'amount',
        sort_order: 'desc',
      });
      act(() => result.current.handleSort('date-desc'));
      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({ sort_by: undefined, sort_order: undefined }),
      );
    });
  });

  describe('clearFilters', () => {
    it('clears all filters except date range', () => {
      const { result, onFiltersChange } = renderFiltersHook({
        search: 'test',
        types: ['expense'],
        date_from: '2024-01-01',
        date_to: '2024-01-31',
      });
      act(() => result.current.clearFilters());
      expect(onFiltersChange).toHaveBeenCalledWith({
        date_from: '2024-01-01',
        date_to: '2024-01-31',
      });
    });
  });

  describe('derived state', () => {
    it('exposes selectedTypes from filters', () => {
      const { result } = renderFiltersHook({ types: ['expense', 'income'] });
      expect(result.current.selectedTypes).toEqual(['expense', 'income']);
    });

    it('exposes selectedAccountIds from filters', () => {
      const { result } = renderFiltersHook({ account_ids: ['a1'] });
      expect(result.current.selectedAccountIds).toEqual(['a1']);
    });

    it('exposes selectedCategoryIds from filters', () => {
      const { result } = renderFiltersHook({ category_ids: ['c1', 'c2'] });
      expect(result.current.selectedCategoryIds).toEqual(['c1', 'c2']);
    });

    it('exposes currentSort', () => {
      const { result } = renderFiltersHook({ sort_by: 'amount', sort_order: 'asc' });
      expect(result.current.currentSort).toBe('amount-asc');
    });

    it('defaults currentSort to date-desc', () => {
      const { result } = renderFiltersHook();
      expect(result.current.currentSort).toBe('date-desc');
    });
  });
});
