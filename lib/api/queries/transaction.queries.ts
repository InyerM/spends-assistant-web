import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import type { Transaction, TransactionFilters } from '@/types';

export const transactionKeys = {
  all: ['transactions'] as const,
  lists: () => [...transactionKeys.all, 'list'] as const,
  list: (filters: TransactionFilters) => [...transactionKeys.lists(), filters] as const,
  infinite: (filters: TransactionFilters) => [...transactionKeys.all, 'infinite', filters] as const,
  details: () => [...transactionKeys.all, 'detail'] as const,
  detail: (id: string) => [...transactionKeys.details(), id] as const,
};

interface TransactionsResult {
  data: Transaction[];
  count: number;
}

async function fetchTransactions(filters: TransactionFilters): Promise<TransactionsResult> {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.type) params.set('type', filters.type);
  if (filters.account_ids?.length) params.set('account_ids', filters.account_ids.join(','));
  else if (filters.account_id) params.set('account_id', filters.account_id);
  if (filters.category_id) params.set('category_id', filters.category_id);
  if (filters.source) params.set('source', filters.source);
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  if (filters.search) params.set('search', filters.search);

  const res = await fetch(`/api/transactions?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch transactions');
  return res.json() as Promise<TransactionsResult>;
}

async function fetchTransaction(id: string): Promise<Transaction> {
  const res = await fetch(`/api/transactions/${id}`);
  if (!res.ok) throw new Error('Failed to fetch transaction');
  return res.json() as Promise<Transaction>;
}

export function useTransactions(
  filters: TransactionFilters = {},
): ReturnType<typeof useQuery<TransactionsResult>> {
  return useQuery({
    queryKey: transactionKeys.list(filters),
    queryFn: () => fetchTransactions(filters),
  });
}

export function useTransaction(id: string): ReturnType<typeof useQuery<Transaction>> {
  return useQuery({
    queryKey: transactionKeys.detail(id),
    queryFn: () => fetchTransaction(id),
    enabled: !!id,
  });
}

interface MonthPageParam {
  year: number;
  month: number;
}

export interface MonthPage {
  data: Transaction[];
  count: number;
  year: number;
  month: number;
}

export function useInfiniteTransactions(
  filters: Omit<TransactionFilters, 'page' | 'limit' | 'date_from' | 'date_to'> = {},
  startYear?: number,
  startMonth?: number,
): ReturnType<
  typeof useInfiniteQuery<
    MonthPage,
    Error,
    { pages: MonthPage[] },
    readonly unknown[],
    MonthPageParam
  >
> {
  const now = new Date();
  const initYear = startYear ?? now.getFullYear();
  const initMonth = startMonth ?? now.getMonth();

  return useInfiniteQuery({
    queryKey: [...transactionKeys.all, 'infinite', filters, initYear, initMonth] as const,
    queryFn: async ({ pageParam }): Promise<MonthPage> => {
      const { year, month } = pageParam;
      const dateFrom = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const dateTo = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const result = await fetchTransactions({
        ...filters,
        date_from: dateFrom,
        date_to: dateTo,
        limit: 500,
      });

      return { ...result, year, month };
    },
    initialPageParam: { year: initYear, month: initMonth },
    getNextPageParam: (_lastPage, _allPages, lastPageParam) => {
      const prevMonth = lastPageParam.month === 0 ? 11 : lastPageParam.month - 1;
      const prevYear = lastPageParam.month === 0 ? lastPageParam.year - 1 : lastPageParam.year;
      return { year: prevYear, month: prevMonth };
    },
  });
}
