'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTransactions } from '@/lib/api/queries/transaction.queries';
import { useCategories } from '@/lib/api/queries/category.queries';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { formatCurrency } from '@/lib/utils/formatting';
import { formatDateForDisplay, formatTimeForDisplay } from '@/lib/utils/date';
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import type { Transaction, TransactionFilters, TransactionType } from '@/types';

const typeBadgeVariant: Record<TransactionType, 'destructive' | 'default' | 'secondary'> = {
  expense: 'destructive',
  income: 'default',
  transfer: 'secondary',
};

interface TransactionListProps {
  filters: TransactionFilters;
  onFiltersChange: (filters: TransactionFilters) => void;
  onEdit: (transaction: Transaction) => void;
}

export function TransactionList({
  filters,
  onFiltersChange,
  onEdit,
}: TransactionListProps): React.ReactElement {
  const { data: result, isLoading } = useTransactions(filters);
  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const totalPages = Math.ceil((result?.count ?? 0) / limit);

  const getCategoryName = (categoryId: string | null): string | null => {
    if (!categoryId || !categories) return null;
    return categories.find((c) => c.id === categoryId)?.name ?? null;
  };

  const getAccountName = (accountId: string): string => {
    if (!accounts) return '';
    return accounts.find((a) => a.id === accountId)?.name ?? '';
  };

  if (isLoading) {
    return (
      <div className='space-y-3'>
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className='h-12 w-full' />
        ))}
      </div>
    );
  }

  const transactions = result?.data ?? [];

  return (
    <div>
      <div className='border-border rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Account</TableHead>
              <TableHead className='text-right'>Amount</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className='w-[50px]' />
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className='text-muted-foreground py-8 text-center'>
                  No transactions found
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((tx) => {
                const categoryName = getCategoryName(tx.category_id);
                return (
                  <TableRow key={tx.id} className='hover:bg-card-overlay'>
                    <TableCell className='text-xs'>
                      <div>{formatDateForDisplay(tx.date)}</div>
                      <div className='text-muted-foreground'>{formatTimeForDisplay(tx.time)}</div>
                    </TableCell>
                    <TableCell>
                      <div className='max-w-[200px] truncate text-sm'>{tx.description}</div>
                      {tx.notes && (
                        <div className='text-muted-foreground max-w-[200px] truncate text-xs'>
                          {tx.notes}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={typeBadgeVariant[tx.type]}>{tx.type}</Badge>
                    </TableCell>
                    <TableCell className='text-sm'>{categoryName ?? '-'}</TableCell>
                    <TableCell className='text-sm'>{getAccountName(tx.account_id)}</TableCell>
                    <TableCell
                      className={`text-right text-sm font-semibold ${
                        tx.type === 'expense'
                          ? 'text-destructive'
                          : tx.type === 'income'
                            ? 'text-success'
                            : 'text-transfer'
                      }`}>
                      {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}
                      {formatCurrency(tx.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant='outline' className='text-xs'>
                        {tx.source}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={(): void => onEdit(tx)}
                        className='h-8 w-8 p-0'>
                        <Pencil className='h-4 w-4' />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className='mt-4 flex items-center justify-between'>
          <p className='text-muted-foreground text-sm'>
            Page {page} of {totalPages} ({result?.count ?? 0} total)
          </p>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              disabled={page <= 1}
              onClick={(): void => onFiltersChange({ ...filters, page: page - 1 })}>
              <ChevronLeft className='h-4 w-4' />
              Previous
            </Button>
            <Button
              variant='outline'
              size='sm'
              disabled={page >= totalPages}
              onClick={(): void => onFiltersChange({ ...filters, page: page + 1 })}>
              Next
              <ChevronRight className='h-4 w-4' />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
