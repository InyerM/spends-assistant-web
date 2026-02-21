'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/shared/search-input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { useCategories } from '@/lib/api/queries/category.queries';
import { useTransactionFilters } from '@/hooks/use-transaction-filters';
import type { TransactionFilters } from '@/types';
import { TRANSACTION_TYPES, SORT_OPTIONS } from '@/lib/constants/transaction';
import {
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

export function TransactionFiltersBar({
  filters,
  onFiltersChange,
}: TransactionFiltersBarProps): React.ReactElement {
  const t = useTranslations('transactions');
  const tCommon = useTranslations('common');
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const {
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
  } = useTransactionFilters({
    filters,
    onFiltersChange,
    accounts,
    categories,
  });

  const parentCategories = categories?.filter((c) => !c.parent_id) ?? [];

  const getChildren = (parentId: string): typeof parentCategories =>
    categories?.filter((c) => c.parent_id === parentId) ?? [];

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

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <SearchInput
        value={filters.search ?? ''}
        onChange={(value): void => onFiltersChange({ ...filters, search: value || undefined })}
        placeholder={`${tCommon('search')}...`}
        className='min-w-[140px] flex-1 sm:min-w-[180px]'
      />

      {/* Type filter - multiselect */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant='outline' className='h-9 cursor-pointer text-sm'>
            {selectedTypes.length > 0
              ? t('typesCount', { count: selectedTypes.length })
              : t('allTypes')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-44 p-2' align='start'>
          <div className='space-y-1'>
            <label className='hover:bg-card-overlay flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium'>
              <Checkbox
                checked={selectedTypes.length === TRANSACTION_TYPES.length}
                onCheckedChange={toggleAllTypes}
              />
              <span>{tCommon('selectAll')}</span>
            </label>
            <div className='bg-border my-1 h-px' />
            {TRANSACTION_TYPES.map((tt) => (
              <label
                key={tt.value}
                className='hover:bg-card-overlay flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm'>
                <Checkbox
                  checked={selectedTypes.includes(tt.value)}
                  onCheckedChange={(): void => toggleType(tt.value)}
                />
                <span>{t(tt.labelKey)}</span>
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
              ? t('accountsCount', { count: selectedAccountIds.length })
              : t('allAccounts')}
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
                  <span>{tCommon('selectAll')}</span>
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
                ? t('categoriesCount', { count: selectedCategoryIds.length })
                : t('allCategories')}
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
                  <span>{tCommon('selectAll')}</span>
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
            {t('sort')}
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
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {activeFilterCount > 0 && (
        <Badge variant='secondary' className='hidden text-xs sm:flex'>
          <SlidersHorizontal className='mr-1 h-3 w-3' />
          {t('filtersApplied', { count: activeFilterCount })}
        </Badge>
      )}
      {activeFilterCount > 0 && (
        <Button variant='ghost' size='sm' className='cursor-pointer text-xs' onClick={clearFilters}>
          <X className='mr-1 h-3 w-3' />
          {t('clear')}
        </Button>
      )}
    </div>
  );
}
