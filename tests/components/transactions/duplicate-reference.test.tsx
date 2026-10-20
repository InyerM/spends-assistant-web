import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Transaction } from '@/types';
const { query } = vi.hoisted(() => ({
  query: { data: null as Transaction | null, isPending: false, isError: false, refetch: vi.fn() },
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'es',
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/lib/api/queries/transaction.queries', () => ({ useTransaction: () => query }));
vi.mock('@/lib/api/queries/account.queries', () => ({ useAccounts: () => ({ data: [] }) }));
vi.mock('@/lib/api/mutations/transaction.mutations', () => ({
  useResolveDuplicate: () => ({ mutate: vi.fn(), isPending: false }),
}));
import { DuplicateReference } from '@/components/transactions/duplicate-reference';
afterEach(() => {
  cleanup();
  query.data = null;
  query.isError = false;
});
it('links the actual stored duplicate with its description, date and native amount', () => {
  query.data = {
    id: 'original',
    description: 'Original lunch',
    date: '2026-10-19',
    amount: 12000,
    currency: 'COP',
  } as Transaction;
  render(
    <DuplicateReference
      transaction={{ id: 'flagged', duplicate_of: 'original' } as Transaction}
      onResolved={vi.fn()}
    />,
  );
  expect(screen.getByText('Original lunch')).toBeVisible();
  expect(screen.getByText(/2026-10-19/)).toBeVisible();
  expect(screen.getByRole('link', { name: 'viewDuplicate' })).toHaveAttribute(
    'href',
    '/transactions/original',
  );
});
it('explains missing or unavailable references instead of presenting a guessed match', () => {
  query.isError = true;
  render(
    <DuplicateReference
      transaction={{ id: 'flagged', duplicate_of: 'missing' } as Transaction}
      onResolved={vi.fn()}
    />,
  );
  expect(screen.getByText('duplicateReferenceUnavailable')).toBeVisible();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
