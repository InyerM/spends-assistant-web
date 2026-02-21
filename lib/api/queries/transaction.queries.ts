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

export interface TransactionsPage {
  data: Transaction[];
  count: number;
  page: number;
}

const PAGE_SIZE = 50;

export async function fetchTransactions(filters: TransactionFilters): Promise<TransactionsResult> {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.types?.length) params.set('types', filters.types.join(','));
  else if (filters.type) params.set('type', filters.type);
  if (filters.account_ids?.length) params.set('account_ids', filters.account_ids.join(','));
  else if (filters.account_id) params.set('account_id', filters.account_id);
  if (filters.category_ids?.length) params.set('category_ids', filters.category_ids.join(','));
  else if (filters.category_id) params.set('category_id', filters.category_id);
  if (filters.source) params.set('source', filters.source);
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  if (filters.search) params.set('search', filters.search);
  if (filters.sort_by) params.set('sort_by', filters.sort_by);
  if (filters.sort_order) params.set('sort_order', filters.sort_order);
  if (filters.duplicate_status) params.set('duplicate_status', filters.duplicate_status);
  if (filters.import_id) params.set('import_id', filters.import_id);

  const res = await fetch(`/api/transactions?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch transactions');
  return res.json() as Promise<TransactionsResult>;
}

export async function fetchTransaction(id: string): Promise<Transaction> {
  const res = await fetch(`/api/transactions/${id}`);
  if (!res.ok) throw new Error('Failed to fetch transaction');
  return res.json() as Promise<Transaction>;
}

export function useTransactions(
  filters: TransactionFilters = {},
  options?: { enabled?: boolean },
): ReturnType<typeof useQuery<TransactionsResult>> {
  return useQuery({
    queryKey: transactionKeys.list(filters),
    queryFn: () => fetchTransactions(filters),
    enabled: options?.enabled,
  });
}

export function useTransaction(id: string): ReturnType<typeof useQuery<Transaction>> {
  return useQuery({
    queryKey: transactionKeys.detail(id),
    queryFn: () => fetchTransaction(id),
    enabled: !!id,
  });
}

export function useInfiniteTransactions(
  filters: Omit<TransactionFilters, 'page' | 'limit'> = {},
): ReturnType<
  typeof useInfiniteQuery<
    TransactionsPage,
    Error,
    { pages: TransactionsPage[] },
    readonly unknown[],
    number
  >
> {
  return useInfiniteQuery({
    queryKey: [...transactionKeys.all, 'infinite', filters] as const,
    queryFn: async ({ pageParam }): Promise<TransactionsPage> => {
      const result = await fetchTransactions({
        ...filters,
        page: pageParam,
        limit: PAGE_SIZE,
      });
      return { ...result, page: pageParam };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage): number | undefined => {
      if (lastPage.data.length < PAGE_SIZE) return undefined;
      return lastPage.page + 1;
    },
  });
}
