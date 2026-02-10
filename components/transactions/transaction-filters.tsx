'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAccounts } from '@/lib/api/queries/account.queries';
import type { TransactionFilters } from '@/types';
import { Search } from 'lucide-react';

interface TransactionFiltersBarProps {
  filters: TransactionFilters;
  onFiltersChange: (filters: TransactionFilters) => void;
}

export function TransactionFiltersBar({
  filters,
  onFiltersChange,
}: TransactionFiltersBarProps): React.ReactElement {
  const { data: accounts } = useAccounts();

  return (
    <div className='flex flex-wrap gap-3'>
      <div className='relative flex-1'>
        <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
        <Input
          placeholder='Search transactions...'
          value={filters.search ?? ''}
          onChange={(e): void =>
            onFiltersChange({ ...filters, search: e.target.value || undefined, page: 1 })
          }
          className='pl-10'
        />
      </div>

      <Select
        value={filters.type ?? 'all'}
        onValueChange={(value): void =>
          onFiltersChange({
            ...filters,
            type: value === 'all' ? undefined : (value as TransactionFilters['type']),
            page: 1,
          })
        }>
        <SelectTrigger className='w-[140px]'>
          <SelectValue placeholder='Type' />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='all'>All Types</SelectItem>
          <SelectItem value='expense'>Expense</SelectItem>
          <SelectItem value='income'>Income</SelectItem>
          <SelectItem value='transfer'>Transfer</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.account_id ?? 'all'}
        onValueChange={(value): void =>
          onFiltersChange({
            ...filters,
            account_id: value === 'all' ? undefined : value,
            page: 1,
          })
        }>
        <SelectTrigger className='w-[180px]'>
          <SelectValue placeholder='Account' />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='all'>All Accounts</SelectItem>
          {accounts?.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              {account.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type='date'
        value={filters.date_from ?? ''}
        onChange={(e): void =>
          onFiltersChange({ ...filters, date_from: e.target.value || undefined, page: 1 })
        }
        className='w-[160px]'
        placeholder='From date'
      />

      <Input
        type='date'
        value={filters.date_to ?? ''}
        onChange={(e): void =>
          onFiltersChange({ ...filters, date_to: e.target.value || undefined, page: 1 })
        }
        className='w-[160px]'
        placeholder='To date'
      />
    </div>
  );
}
