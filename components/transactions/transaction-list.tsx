'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useInfiniteTransactions, type MonthPage } from '@/lib/api/queries/transaction.queries';
import { useCategories } from '@/lib/api/queries/category.queries';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { formatCurrency } from '@/lib/utils/formatting';
import { formatTimeForDisplay } from '@/lib/utils/date';
import { ArrowDownLeft, ArrowUpRight, ArrowRightLeft, Loader2 } from 'lucide-react';
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

interface MonthSection {
  label: string;
  year: number;
  month: number;
  dateGroups: DateGroup[];
  monthTotal: number;
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

function buildMonthSections(pages: MonthPage[]): MonthSection[] {
  return pages
    .filter((page) => page.data.length > 0)
    .map((page) => {
      const grouped = new Map<string, Transaction[]>();
      for (const tx of page.data) {
        const existing = grouped.get(tx.date) ?? [];
        existing.push(tx);
        grouped.set(tx.date, existing);
      }

      const dateGroups: DateGroup[] = Array.from(grouped.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, txs]) => ({
          date,
          displayDate: formatDateLabel(date),
          transactions: txs,
          total: computeDayTotal(txs),
        }));

      const monthTotal = dateGroups.reduce((sum, g) => sum + g.total, 0);

      return {
        label: `${MONTH_NAMES[page.month]} ${page.year}`,
        year: page.year,
        month: page.month,
        dateGroups,
        monthTotal,
      };
    });
}

interface TransactionListProps {
  filters: Omit<TransactionFilters, 'page' | 'limit' | 'date_from' | 'date_to'>;
  onEdit: (transaction: Transaction) => void;
  year?: number;
  month?: number;
}

export function TransactionList({
  filters,
  onEdit,
  year,
  month,
}: TransactionListProps): React.ReactElement {
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteTransactions(filters, year, month);
  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();
  const bottomRef = useRef<HTMLDivElement>(null);

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

  const sections = buildMonthSections(data?.pages ?? []);

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
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className='h-14 w-full rounded-lg' />
        ))}
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className='text-muted-foreground py-16 text-center text-sm'>No transactions found</div>
    );
  }

  return (
    <div className='space-y-6'>
      {sections.map((section) => (
        <div key={`${section.year}-${section.month}`}>
          {section.dateGroups.map((group) => (
            <div key={group.date} className='mb-4'>
              <div className='border-border mb-2 flex items-center justify-between border-b pb-2'>
                <span className='text-muted-foreground text-sm font-medium'>
                  {group.displayDate}
                </span>
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
                  const categoryName = getCategoryName(tx.category_id);
                  const accountName = getAccountName(tx.account_id);

                  return (
                    <button
                      key={tx.id}
                      onClick={(): void => onEdit(tx)}
                      className='hover:bg-card-overlay flex w-full cursor-pointer items-center gap-3 rounded-lg p-3 text-left transition-colors'>
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
                          {categoryName && (
                            <>
                              <span>·</span>
                              <Badge
                                variant='secondary'
                                className='h-5 shrink-0 px-1.5 text-[10px]'>
                                {categoryName}
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
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}

      <div ref={bottomRef} className='flex justify-center py-4'>
        {isFetchingNextPage ? (
          <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
        ) : hasNextPage ? (
          <Button variant='ghost' size='sm' onClick={(): void => void fetchNextPage()}>
            Load more
          </Button>
        ) : null}
      </div>
    </div>
  );
}
