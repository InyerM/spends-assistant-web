'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  useInfiniteTransactions,
  type TransactionsPage,
} from '@/lib/api/queries/transaction.queries';
import { useCategories } from '@/lib/api/queries/category.queries';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { formatCurrency } from '@/lib/utils/formatting';
import { formatTimeForDisplay } from '@/lib/utils/date';
import { ArrowDownLeft, ArrowUpRight, ArrowRightLeft, Loader2, Info } from 'lucide-react';
import type { Transaction, TransactionType, TransactionFilters } from '@/types';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const typeConfig: Record<TransactionType, { icon: typeof ArrowDownLeft; colorClass: string }> = {
  expense: { icon: ArrowUpRight, colorClass: 'text-destructive' },
  income: { icon: ArrowDownLeft, colorClass: 'text-success' },
  transfer: { icon: ArrowRightLeft, colorClass: 'text-transfer' },
};

interface DateGroup {
  date: string;
  displayDate: string;
  transactions: Transaction[];
  total: number;
}

function formatDateLabel(dateStr: string): string {
  const [year, monthStr, day] = dateStr.split('-');
  const monthIndex = parseInt(monthStr, 10) - 1;
  return `${MONTH_NAMES[monthIndex]} ${parseInt(day, 10)}, ${year}`;
}

function computeDayTotal(transactions: Transaction[]): number {
  let total = 0;
  for (const tx of transactions) {
    if (tx.type === 'expense') total -= tx.amount;
    else if (tx.type === 'income') total += tx.amount;
  }
  return total;
}

function buildDateGroups(
  pages: TransactionsPage[],
  sortBy?: string,
  sortOrder?: string,
): DateGroup[] {
  const allTransactions = pages.flatMap((p) => p.data);
  const grouped = new Map<string, Transaction[]>();

  for (const tx of allTransactions) {
    const existing = grouped.get(tx.date) ?? [];
    existing.push(tx);
    grouped.set(tx.date, existing);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) =>
      sortBy === 'date' && sortOrder === 'asc' ? a.localeCompare(b) : b.localeCompare(a),
    )
    .map(([date, txs]) => {
      if (sortBy === 'amount') {
        txs.sort((a, b) => (sortOrder === 'asc' ? a.amount - b.amount : b.amount - a.amount));
      }
      return {
        date,
        displayDate: formatDateLabel(date),
        transactions: txs,
        total: computeDayTotal(txs),
      };
    });
}

function MetadataField({
  label,
  value,
}: {
  label: string;
  value: string | number | boolean | Record<string, unknown> | null;
}): React.ReactElement {
  if (value === null || value === '') {
    return (
      <div>
        <p className='text-muted-foreground text-xs font-medium'>{label}</p>
        <p className='text-muted-foreground text-sm italic'>—</p>
      </div>
    );
  }

  const isObject = typeof value === 'object';

  return (
    <div>
      <p className='text-muted-foreground text-xs font-medium'>{label}</p>
      {isObject ? (
        <pre className='bg-card-overlay mt-1 max-h-[150px] overflow-auto rounded-md p-2 text-xs'>
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : (
        <p className='text-foreground text-sm'>{String(value)}</p>
      )}
    </div>
  );
}

interface TransactionListProps {
  filters: Omit<TransactionFilters, 'page' | 'limit'>;
  onEdit: (transaction: Transaction) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  selectMode?: boolean;
}

export function TransactionList({
  filters,
  onEdit,
  selectedIds,
  onToggleSelect,
  selectMode = false,
}: TransactionListProps): React.ReactElement {
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteTransactions(filters);
  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [metadataTx, setMetadataTx] = useState<Transaction | null>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleObserver, { threshold: 0.1 });
    observer.observe(el);
    return (): void => observer.disconnect();
  }, [handleObserver]);

  const dateGroups = buildDateGroups(data?.pages ?? [], filters.sort_by, filters.sort_order);

  const getCategory = (
    categoryId: string | null,
  ): { name: string; color: string | null } | null => {
    if (!categoryId || !categories) return null;
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return null;
    // If child category, inherit parent color if not set
    if (!cat.color && cat.parent_id) {
      const parent = categories.find((c) => c.id === cat.parent_id);
      return { name: cat.name, color: parent?.color ?? null };
    }
    return { name: cat.name, color: cat.color };
  };

  const getAccountName = (accountId: string): string => {
    if (!accounts) return '';
    return accounts.find((a) => a.id === accountId)?.name ?? '';
  };

  if (isLoading) {
    return (
      <div className='space-y-3'>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className='h-14 w-full rounded-lg' />
        ))}
      </div>
    );
  }

  if (dateGroups.length === 0) {
    return (
      <div className='text-muted-foreground py-16 text-center text-sm'>No transactions found</div>
    );
  }

  return (
    <div className='space-y-6'>
      {dateGroups.map((group) => (
        <div key={group.date} className='mb-4'>
          <div className='border-border mb-2 flex items-center justify-between border-b pb-2'>
            <span className='text-muted-foreground text-sm font-medium'>{group.displayDate}</span>
            <span
              className={`text-sm font-semibold ${group.total >= 0 ? 'text-success' : 'text-destructive'}`}>
              {group.total >= 0 ? '+' : ''}
              {formatCurrency(group.total)}
            </span>
          </div>

          <div className='space-y-0.5'>
            {group.transactions.map((tx) => {
              const config = typeConfig[tx.type];
              const Icon = config.icon;
              const categoryInfo = getCategory(tx.category_id);
              const accountName = getAccountName(tx.account_id);
              const hasMetadata = tx.raw_text || tx.parsed_data || tx.notes;

              const isSelected = selectedIds?.has(tx.id) ?? false;

              return (
                <div
                  key={tx.id}
                  className={`hover:bg-card-overlay flex items-center gap-3 rounded-lg p-3 transition-colors ${isSelected ? 'bg-card-overlay' : ''}`}>
                  {selectMode && onToggleSelect && (
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(): void => onToggleSelect(tx.id)}
                      className='shrink-0'
                    />
                  )}
                  <button
                    onClick={(): void => {
                      if (selectMode && onToggleSelect) {
                        onToggleSelect(tx.id);
                      } else {
                        onEdit(tx);
                      }
                    }}
                    className='flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left'>
                    <div
                      className={`bg-card-overlay flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${config.colorClass}`}>
                      <Icon className='h-4 w-4' />
                    </div>

                    <div className='min-w-0 flex-1'>
                      <p className='text-foreground truncate text-sm font-medium'>
                        {tx.description}
                      </p>
                      <div className='text-muted-foreground flex items-center gap-1.5 text-xs'>
                        <span className='truncate'>{accountName}</span>
                        {categoryInfo && (
                          <>
                            <span>·</span>
                            <Badge
                              variant='secondary'
                              className='h-5 shrink-0 px-1.5 text-[10px]'
                              style={
                                categoryInfo.color
                                  ? {
                                      backgroundColor: `${categoryInfo.color}20`,
                                      color: categoryInfo.color,
                                      borderColor: `${categoryInfo.color}40`,
                                    }
                                  : undefined
                              }>
                              {categoryInfo.name}
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>

                    <div className='shrink-0 text-right'>
                      <p className={`text-sm font-semibold ${config.colorClass}`}>
                        {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}
                        {formatCurrency(tx.amount)}
                      </p>
                      <p className='text-muted-foreground text-xs'>
                        {formatTimeForDisplay(tx.time)}
                      </p>
                    </div>
                  </button>

                  {!selectMode && hasMetadata && (
                    <button
                      onClick={(): void => setMetadataTx(tx)}
                      className='text-muted-foreground hover:text-foreground cursor-pointer rounded-md p-1.5 transition-colors'
                      title='View details'>
                      <Info className='h-4 w-4' />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div ref={bottomRef} className='flex justify-center py-4'>
        {isFetchingNextPage ? (
          <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
        ) : hasNextPage ? (
          <Button variant='ghost' size='sm' onClick={(): void => void fetchNextPage()}>
            Load more
          </Button>
        ) : (
          <p className='text-muted-foreground text-xs'>No more transactions</p>
        )}
      </div>

      {/* Metadata dialog */}
      <Dialog
        open={metadataTx !== null}
        onOpenChange={(o): void => {
          if (!o) setMetadataTx(null);
        }}>
        <DialogContent className='border-border bg-card max-h-[80vh] overflow-hidden sm:max-w-[500px]'>
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>
          {metadataTx && (
            <div className='min-h-0 space-y-4 overflow-y-auto'>
              <div className='grid grid-cols-2 gap-4'>
                <MetadataField label='Source' value={metadataTx.source} />
                <MetadataField label='Confidence' value={metadataTx.confidence} />
              </div>
              <MetadataField label='Notes' value={metadataTx.notes} />
              <MetadataField label='Raw Text' value={metadataTx.raw_text} />
              <MetadataField label='Parsed Data' value={metadataTx.parsed_data} />
              <div className='grid grid-cols-2 gap-4'>
                <MetadataField label='Payment Method' value={metadataTx.payment_method} />
                <MetadataField label='Reconciled' value={metadataTx.is_reconciled ? 'Yes' : 'No'} />
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <MetadataField label='Created' value={metadataTx.created_at} />
                <MetadataField label='Updated' value={metadataTx.updated_at} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
