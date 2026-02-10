'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MonthSelector } from '@/components/dashboard/month-selector';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { useCategories } from '@/lib/api/queries/category.queries';
import type { TransactionFilters } from '@/types';
import { Search, Wallet, Tag, X } from 'lucide-react';

type ListFilters = Omit<TransactionFilters, 'page' | 'limit' | 'date_from' | 'date_to'>;

interface TransactionFiltersBarProps {
  filters: ListFilters;
  onFiltersChange: (filters: ListFilters) => void;
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
}

export function TransactionFiltersBar({
  filters,
  onFiltersChange,
  year,
  month,
  onMonthChange,
}: TransactionFiltersBarProps): React.ReactElement {
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();

  const selectedAccountIds = filters.account_ids ?? [];
  const hasFilters =
    filters.search || filters.type || selectedAccountIds.length > 0 || filters.category_id;

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

  const clearFilters = (): void => {
    onFiltersChange({});
  };

  const parentCategories = categories?.filter((c) => !c.parent_id) ?? [];

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between'>
        <MonthSelector year={year} month={month} onChange={onMonthChange} />
        {hasFilters && (
          <Button
            variant='ghost'
            size='sm'
            className='cursor-pointer text-xs'
            onClick={clearFilters}>
            <X className='mr-1 h-3 w-3' />
            Clear filters
          </Button>
        )}
      </div>

      <div className='flex flex-wrap gap-2'>
        <div className='relative min-w-[180px] flex-1'>
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

        <Select
          value={filters.type ?? 'all'}
          onValueChange={(value): void =>
            onFiltersChange({
              ...filters,
              type: value === 'all' ? undefined : (value as TransactionFilters['type']),
            })
          }>
          <SelectTrigger className='h-9 w-[120px] text-sm'>
            <SelectValue placeholder='Type' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Types</SelectItem>
            <SelectItem value='expense'>Expense</SelectItem>
            <SelectItem value='income'>Income</SelectItem>
            <SelectItem value='transfer'>Transfer</SelectItem>
          </SelectContent>
        </Select>

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

        <Select
          value={filters.category_id ?? 'all'}
          onValueChange={(value): void =>
            onFiltersChange({
              ...filters,
              category_id: value === 'all' ? undefined : value,
            })
          }>
          <SelectTrigger className='h-9 w-[160px] text-sm'>
            <div className='flex items-center gap-1.5'>
              <Tag className='h-3.5 w-3.5' />
              <SelectValue placeholder='Category' />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Categories</SelectItem>
            {parentCategories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.icon ?? ''} {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
