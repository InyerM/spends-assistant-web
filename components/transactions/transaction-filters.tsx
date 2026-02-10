'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PeriodSelector } from '@/components/transactions/period-selector';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { useCategories } from '@/lib/api/queries/category.queries';
import type { TransactionFilters, TransactionType } from '@/types';
import {
  Search,
  Wallet,
  Tag,
  X,
  SlidersHorizontal,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';

type ListFilters = Omit<TransactionFilters, 'page' | 'limit'>;

interface TransactionFiltersBarProps {
  filters: ListFilters;
  onFiltersChange: (filters: ListFilters) => void;
}

const TRANSACTION_TYPES: { value: TransactionType; label: string }[] = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'date-desc', label: 'Newest first' },
  { value: 'date-asc', label: 'Oldest first' },
  { value: 'amount-desc', label: 'Highest amount' },
  { value: 'amount-asc', label: 'Lowest amount' },
];

function countActiveFilters(filters: ListFilters): number {
  let count = 0;
  if (filters.search) count++;
  if (filters.types?.length) count++;
  if (filters.account_ids?.length) count++;
  if (filters.category_ids?.length) count++;
  if (filters.sort_by) count++;
  return count;
}

export function TransactionFiltersBar({
  filters,
  onFiltersChange,
}: TransactionFiltersBarProps): React.ReactElement {
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const selectedTypes = filters.types ?? [];
  const selectedAccountIds = filters.account_ids ?? [];
  const selectedCategoryIds = filters.category_ids ?? [];
  const activeFilterCount = countActiveFilters(filters);
  const currentSort = `${filters.sort_by ?? 'date'}-${filters.sort_order ?? 'desc'}`;

  const parentCategories = categories?.filter((c) => !c.parent_id) ?? [];

  const getChildren = (parentId: string): typeof parentCategories =>
    categories?.filter((c) => c.parent_id === parentId) ?? [];

  const handlePeriodChange = (dateFrom: string, dateTo: string): void => {
    onFiltersChange({ ...filters, date_from: dateFrom, date_to: dateTo });
  };

  // Type filter
  const toggleType = (type: TransactionType): void => {
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
  };

  const toggleAllTypes = (): void => {
    const allSelected = selectedTypes.length === TRANSACTION_TYPES.length;
    onFiltersChange({
      ...filters,
      types: allSelected ? undefined : TRANSACTION_TYPES.map((t) => t.value),
    });
  };

  // Account filter
  const toggleAccount = (accountId: string): void => {
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
  };

  const toggleAllAccounts = (): void => {
    if (!accounts) return;
    const allSelected = selectedAccountIds.length === accounts.length;
    onFiltersChange({
      ...filters,
      account_ids: allSelected ? undefined : accounts.map((a) => a.id),
    });
  };

  // Category filter
  const toggleAllCategories = (): void => {
    if (!categories) return;
    const allIds = categories.map((c) => c.id);
    const allSelected = selectedCategoryIds.length === allIds.length;
    onFiltersChange({
      ...filters,
      category_ids: allSelected ? undefined : allIds,
    });
  };

  const toggleCategory = (categoryId: string): void => {
    const children = getChildren(categoryId);
    const childIds = children.map((c) => c.id);
    const allIds = [categoryId, ...childIds];

    const isParentSelected = selectedCategoryIds.includes(categoryId);

    let updated: string[];
    if (isParentSelected) {
      // Deselect parent + all children
      updated = selectedCategoryIds.filter((id) => !allIds.includes(id));
    } else {
      // Select parent + all children
      updated = [...new Set([...selectedCategoryIds, ...allIds])];
    }

    onFiltersChange({
      ...filters,
      category_ids: updated.length > 0 ? updated : undefined,
    });
  };

  const toggleSubcategory = (subcategoryId: string, parentId: string): void => {
    const current = [...selectedCategoryIds];
    const index = current.indexOf(subcategoryId);
    if (index >= 0) {
      current.splice(index, 1);
      // Also deselect parent if a child is deselected
      const parentIndex = current.indexOf(parentId);
      if (parentIndex >= 0) current.splice(parentIndex, 1);
    } else {
      current.push(subcategoryId);
      // Check if all siblings are selected, then select parent too
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
  };

  const toggleExpandCategory = (categoryId: string): void => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Sort
  const handleSort = (value: string): void => {
    const [sortBy, sortOrder] = value.split('-') as ['date' | 'amount', 'asc' | 'desc'];
    const isDefault = sortBy === 'date' && sortOrder === 'desc';
    onFiltersChange({
      ...filters,
      sort_by: isDefault ? undefined : sortBy,
      sort_order: isDefault ? undefined : sortOrder,
    });
  };

  const clearFilters = (): void => {
    onFiltersChange({ date_from: filters.date_from, date_to: filters.date_to });
  };

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between'>
        <PeriodSelector
          dateFrom={filters.date_from ?? ''}
          dateTo={filters.date_to ?? ''}
          onChange={handlePeriodChange}
        />
        <div className='flex items-center gap-2'>
          {activeFilterCount > 0 && (
            <Badge variant='secondary' className='hidden text-xs sm:flex'>
              <SlidersHorizontal className='mr-1 h-3 w-3' />
              {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} applied
            </Badge>
          )}
          {activeFilterCount > 0 && (
            <Button
              variant='ghost'
              size='sm'
              className='cursor-pointer text-xs'
              onClick={clearFilters}>
              <X className='mr-1 h-3 w-3' />
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className='flex flex-wrap gap-2'>
        <div className='relative min-w-[140px] flex-1 sm:min-w-[180px]'>
          <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
          <Input
            placeholder='Search...'
            value={filters.search ?? ''}
            onChange={(e): void =>
              onFiltersChange({ ...filters, search: e.target.value || undefined })
            }
            className='h-9 pl-10 text-sm'
          />
        </div>

        {/* Type filter - multiselect */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant='outline' className='h-9 cursor-pointer text-sm'>
              {selectedTypes.length > 0
                ? `${selectedTypes.length} type${selectedTypes.length > 1 ? 's' : ''}`
                : 'All Types'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className='w-44 p-2' align='start'>
            <div className='space-y-1'>
              <label className='hover:bg-card-overlay flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium'>
                <Checkbox
                  checked={selectedTypes.length === TRANSACTION_TYPES.length}
                  onCheckedChange={toggleAllTypes}
                />
                <span>Select all</span>
              </label>
              <div className='bg-border my-1 h-px' />
              {TRANSACTION_TYPES.map((t) => (
                <label
                  key={t.value}
                  className='hover:bg-card-overlay flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm'>
                  <Checkbox
                    checked={selectedTypes.includes(t.value)}
                    onCheckedChange={(): void => toggleType(t.value)}
                  />
                  <span>{t.label}</span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Account filter - multiselect with select all */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant='outline' className='h-9 cursor-pointer text-sm'>
              <Wallet className='mr-1.5 h-3.5 w-3.5' />
              {selectedAccountIds.length > 0
                ? `${selectedAccountIds.length} account${selectedAccountIds.length > 1 ? 's' : ''}`
                : 'All Accounts'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className='w-56 p-2' align='start'>
            <div className='space-y-1'>
              {accounts && accounts.length > 0 && (
                <>
                  <label className='hover:bg-card-overlay flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium'>
                    <Checkbox
                      checked={selectedAccountIds.length === accounts.length}
                      onCheckedChange={toggleAllAccounts}
                    />
                    <span>Select all</span>
                  </label>
                  <div className='bg-border my-1 h-px' />
                </>
              )}
              {accounts?.map((account) => (
                <label
                  key={account.id}
                  className='hover:bg-card-overlay flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm'>
                  <Checkbox
                    checked={selectedAccountIds.includes(account.id)}
                    onCheckedChange={(): void => toggleAccount(account.id)}
                  />
                  <span className='truncate'>{account.name}</span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Category filter - hierarchical multiselect */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant='outline' className='h-9 max-w-[180px] cursor-pointer text-sm'>
              <Tag className='mr-1.5 h-3.5 w-3.5 shrink-0' />
              <span className='truncate'>
                {selectedCategoryIds.length > 0
                  ? `${selectedCategoryIds.length} categor${selectedCategoryIds.length > 1 ? 'ies' : 'y'}`
                  : 'All Categories'}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className='max-h-[300px] w-64 overflow-y-auto p-2' align='start'>
            <div className='space-y-0.5'>
              {categories && categories.length > 0 && (
                <>
                  <label className='hover:bg-card-overlay flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium'>
                    <Checkbox
                      checked={selectedCategoryIds.length === categories.length}
                      onCheckedChange={toggleAllCategories}
                    />
                    <span>Select all</span>
                  </label>
                  <div className='bg-border my-1 h-px' />
                </>
              )}
              {parentCategories.map((cat) => {
                const children = getChildren(cat.id);
                const hasChildren = children.length > 0;
                const isExpanded = expandedCategories.has(cat.id);

                return (
                  <div key={cat.id}>
                    <div className='hover:bg-card-overlay flex items-center gap-1 rounded-md px-1 py-1'>
                      {hasChildren ? (
                        <button
                          onClick={(): void => toggleExpandCategory(cat.id)}
                          className='cursor-pointer p-0.5'>
                          {isExpanded ? (
                            <ChevronDown className='h-3.5 w-3.5' />
                          ) : (
                            <ChevronRight className='h-3.5 w-3.5' />
                          )}
                        </button>
                      ) : (
                        <span className='w-[18px]' />
                      )}
                      <label className='flex min-w-0 flex-1 cursor-pointer items-center gap-2'>
                        <Checkbox
                          checked={selectedCategoryIds.includes(cat.id)}
                          onCheckedChange={(): void => toggleCategory(cat.id)}
                        />
                        <span className='truncate text-sm'>
                          {cat.icon ? `${cat.icon} ` : ''}
                          {cat.name}
                        </span>
                      </label>
                    </div>
                    {hasChildren && isExpanded && (
                      <div className='ml-5 space-y-0.5'>
                        {children.map((sub) => (
                          <label
                            key={sub.id}
                            className='hover:bg-card-overlay flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm'>
                            <Checkbox
                              checked={selectedCategoryIds.includes(sub.id)}
                              onCheckedChange={(): void => toggleSubcategory(sub.id, cat.id)}
                            />
                            <span className='truncate'>
                              {sub.icon ? `${sub.icon} ` : ''}
                              {sub.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        {/* Sort */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant='outline' className='h-9 cursor-pointer text-sm'>
              <ArrowUpDown className='mr-1.5 h-3.5 w-3.5' />
              Sort
            </Button>
          </PopoverTrigger>
          <PopoverContent className='w-48 p-2' align='end'>
            <div className='space-y-0.5'>
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={(): void => handleSort(opt.value)}
                  className={`w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                    currentSort === opt.value
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-card-overlay'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
