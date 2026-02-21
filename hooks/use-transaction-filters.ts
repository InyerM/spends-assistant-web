import { useCallback, useMemo } from 'react';
import type { TransactionFilters, TransactionType } from '@/types';
import type { Account } from '@/types';
import type { Category } from '@/types';

type ListFilters = Omit<TransactionFilters, 'page' | 'limit'>;

const TRANSACTION_TYPES: TransactionType[] = ['expense', 'income', 'transfer'];

interface UseTransactionFiltersOptions {
  filters: ListFilters;
  onFiltersChange: (filters: ListFilters) => void;
  accounts: Account[] | undefined;
  categories: Category[] | undefined;
}

interface UseTransactionFiltersReturn {
  selectedTypes: TransactionType[];
  selectedAccountIds: string[];
  selectedCategoryIds: string[];
  activeFilterCount: number;
  currentSort: string;
  toggleType: (type: TransactionType) => void;
  toggleAllTypes: () => void;
  toggleAccount: (accountId: string) => void;
  toggleAllAccounts: () => void;
  toggleCategory: (categoryId: string) => void;
  toggleSubcategory: (subcategoryId: string, parentId: string) => void;
  toggleAllCategories: () => void;
  handleSort: (value: string) => void;
  clearFilters: () => void;
}

function countActiveFilters(filters: ListFilters): number {
  let count = 0;
  if (filters.search) count++;
  if (filters.types?.length) count++;
  if (filters.account_ids?.length) count++;
  if (filters.category_ids?.length) count++;
  if (filters.sort_by) count++;
  return count;
}

export function useTransactionFilters({
  filters,
  onFiltersChange,
  accounts,
  categories,
}: UseTransactionFiltersOptions): UseTransactionFiltersReturn {
  const selectedTypes = useMemo(() => filters.types ?? [], [filters.types]);
  const selectedAccountIds = useMemo(() => filters.account_ids ?? [], [filters.account_ids]);
  const selectedCategoryIds = useMemo(() => filters.category_ids ?? [], [filters.category_ids]);
  const activeFilterCount = countActiveFilters(filters);
  const currentSort = `${filters.sort_by ?? 'date'}-${filters.sort_order ?? 'desc'}`;

  const getChildren = useCallback(
    (parentId: string): Category[] => categories?.filter((c) => c.parent_id === parentId) ?? [],
    [categories],
  );

  const toggleType = useCallback(
    (type: TransactionType): void => {
      const current = [...selectedTypes];
      const index = current.indexOf(type);
      if (index >= 0) {
        current.splice(index, 1);
      } else {
        current.push(type);
      }
      onFiltersChange({
        ...filters,
        types: current.length > 0 ? current : undefined,
      });
    },
    [selectedTypes, filters, onFiltersChange],
  );

  const toggleAllTypes = useCallback((): void => {
    const allSelected = selectedTypes.length === TRANSACTION_TYPES.length;
    onFiltersChange({
      ...filters,
      types: allSelected ? undefined : [...TRANSACTION_TYPES],
    });
  }, [selectedTypes.length, filters, onFiltersChange]);

  const toggleAccount = useCallback(
    (accountId: string): void => {
      const current = [...selectedAccountIds];
      const index = current.indexOf(accountId);
      if (index >= 0) {
        current.splice(index, 1);
      } else {
        current.push(accountId);
      }
      onFiltersChange({
        ...filters,
        account_ids: current.length > 0 ? current : undefined,
      });
    },
    [selectedAccountIds, filters, onFiltersChange],
  );

  const toggleAllAccounts = useCallback((): void => {
    if (!accounts) return;
    const allSelected = selectedAccountIds.length === accounts.length;
    onFiltersChange({
      ...filters,
      account_ids: allSelected ? undefined : accounts.map((a) => a.id),
    });
  }, [accounts, selectedAccountIds.length, filters, onFiltersChange]);

  const toggleAllCategories = useCallback((): void => {
    if (!categories) return;
    const allIds = categories.map((c) => c.id);
    const allSelected = selectedCategoryIds.length === allIds.length;
    onFiltersChange({
      ...filters,
      category_ids: allSelected ? undefined : allIds,
    });
  }, [categories, selectedCategoryIds.length, filters, onFiltersChange]);

  const toggleCategory = useCallback(
    (categoryId: string): void => {
      const children = getChildren(categoryId);
      const childIds = children.map((c) => c.id);
      const allIds = [categoryId, ...childIds];

      const isParentSelected = selectedCategoryIds.includes(categoryId);

      let updated: string[];
      if (isParentSelected) {
        updated = selectedCategoryIds.filter((id) => !allIds.includes(id));
      } else {
        updated = [...new Set([...selectedCategoryIds, ...allIds])];
      }

      onFiltersChange({
        ...filters,
        category_ids: updated.length > 0 ? updated : undefined,
      });
    },
    [getChildren, selectedCategoryIds, filters, onFiltersChange],
  );

  const toggleSubcategory = useCallback(
    (subcategoryId: string, parentId: string): void => {
      const current = [...selectedCategoryIds];
      const index = current.indexOf(subcategoryId);
      if (index >= 0) {
        current.splice(index, 1);
        const parentIndex = current.indexOf(parentId);
        if (parentIndex >= 0) current.splice(parentIndex, 1);
      } else {
        current.push(subcategoryId);
        const siblings = getChildren(parentId);
        const allSiblingsSelected = siblings.every(
          (s) => s.id === subcategoryId || current.includes(s.id),
        );
        if (allSiblingsSelected && !current.includes(parentId)) {
          current.push(parentId);
        }
      }
      onFiltersChange({
        ...filters,
        category_ids: current.length > 0 ? current : undefined,
      });
    },
    [getChildren, selectedCategoryIds, filters, onFiltersChange],
  );

  const handleSort = useCallback(
    (value: string): void => {
      const [sortBy, sortOrder] = value.split('-') as ['date' | 'amount', 'asc' | 'desc'];
      const isDefault = sortBy === 'date' && sortOrder === 'desc';
      onFiltersChange({
        ...filters,
        sort_by: isDefault ? undefined : sortBy,
        sort_order: isDefault ? undefined : sortOrder,
      });
    },
    [filters, onFiltersChange],
  );

  const clearFilters = useCallback((): void => {
    onFiltersChange({ date_from: filters.date_from, date_to: filters.date_to });
  }, [filters.date_from, filters.date_to, onFiltersChange]);

  return useMemo(
    () => ({
      selectedTypes,
      selectedAccountIds,
      selectedCategoryIds,
      activeFilterCount,
      currentSort,
      toggleType,
      toggleAllTypes,
      toggleAccount,
      toggleAllAccounts,
      toggleCategory,
      toggleSubcategory,
      toggleAllCategories,
      handleSort,
      clearFilters,
    }),
    [
      selectedTypes,
      selectedAccountIds,
      selectedCategoryIds,
      activeFilterCount,
      currentSort,
      toggleType,
      toggleAllTypes,
      toggleAccount,
      toggleAllAccounts,
      toggleCategory,
      toggleSubcategory,
      toggleAllCategories,
      handleSort,
      clearFilters,
    ],
  );
}
