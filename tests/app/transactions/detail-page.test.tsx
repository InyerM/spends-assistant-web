import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TransactionDetailPage from '@/app/(dashboard)/transactions/[id]/page';

vi.mock('next-intl', () => ({
  useTranslations:
    (namespace: string) =>
    (key: string): string =>
      `${namespace}.${key}`,
  useLocale: () => 'es',
}));
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'transaction-1' }) }));
vi.mock('@/lib/api/queries/transaction.queries', () => ({
  useTransaction: () => ({
    data: {
      id: 'transaction-1',
      date: '2026-09-29',
      time: '13:25:00',
      description: 'Almuerzos Liliana',
      amount: 36000,
      type: 'expense',
      account_id: 'account-1',
      category_id: null,
      source: 'sms',
      notes: null,
    },
    isLoading: false,
    isError: false,
  }),
}));
vi.mock('@/lib/api/queries/account.queries', () => ({
  useAccounts: () => ({ data: [{ id: 'account-1', name: 'Bancolombia' }] }),
}));
vi.mock('@/lib/api/queries/category.queries', () => ({ useCategories: () => ({ data: [] }) }));

describe('transaction detail', () => {
  it('opens a reviewed link to one exact transaction', () => {
    render(<TransactionDetailPage />);
    expect(screen.getByText('Almuerzos Liliana')).toBeInTheDocument();
    expect(screen.getByText('Bancolombia')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'transactions.title' })).toHaveAttribute(
      'href',
      '/transactions',
    );
  });
});
