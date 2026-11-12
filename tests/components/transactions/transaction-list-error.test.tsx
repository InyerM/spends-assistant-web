import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => ({
  data: undefined,
  isLoading: false,
  isError: true,
  isFetching: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
  refetch: vi.fn(),
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/lib/api/queries/transaction.queries', () => ({ useInfiniteTransactions: () => query }));
vi.mock('@/lib/api/queries/statement.queries', () => ({
  useStatementProofs: () => ({ data: [] }),
}));
vi.mock('@/lib/api/queries/category.queries', () => ({ useCategories: () => ({ data: [] }) }));
vi.mock('@/lib/api/queries/account.queries', () => ({ useAccounts: () => ({ data: [] }) }));
vi.mock('@/lib/api/mutations/transaction.mutations', () => ({ useDeleteTransaction: () => ({}) }));
vi.mock('@/hooks/use-infinite-scroll', () => ({ useInfiniteScroll: () => ({ current: null }) }));
import { TransactionList } from '@/components/transactions/transaction-list';

afterEach(cleanup);

beforeEach(() => {
  query.isError = true;
  query.isFetching = false;
  query.refetch.mockClear();
});
it('distinguishes a failed transaction request from an empty account and lets the user retry', () => {
  render(<TransactionList filters={{}} onEdit={vi.fn()} />);
  expect(screen.getByRole('alert')).toHaveTextContent('loadError');
  expect(screen.queryByText('noTransactions')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'retry' }));
  expect(query.refetch).toHaveBeenCalledOnce();
});
it('keeps the empty state for a successful empty request', () => {
  query.isError = false;
  render(<TransactionList filters={{}} onEdit={vi.fn()} />);
  expect(screen.getByText('noTransactions')).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('disables retry while the failed request is being retried', () => {
  query.isFetching = true;
  render(<TransactionList filters={{}} onEdit={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'retry' })).toBeDisabled();
});
