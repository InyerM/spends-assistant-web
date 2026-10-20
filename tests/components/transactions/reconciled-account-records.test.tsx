import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { Account } from '@/types';
vi.mock('next-intl', () => ({
  useLocale: () => 'es',
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/lib/api/queries/transaction.queries', () => ({
  useTransactions: () => ({
    data: {
      data: [
        {
          id: 'tx',
          type: 'transfer',
          description: 'Card payment',
          account_id: 'cop',
          transfer_to_account_id: 'usd',
          amount: 21000,
          destination_amount: 5,
          source_currency: 'USD',
          currency: 'COP',
          date: '2026-09-01',
        },
      ],
    },
  }),
}));
vi.mock('@/lib/api/queries/statement.queries', () => ({
  useStatementProofs: () => ({
    data: [{ transaction_id: 'tx', document_id: 'statement', observation_id: 'row', valid: true }],
  }),
}));
import { AccountRecords } from '@/components/accounts/account-records';
it('shows a reconciled received transfer in the account currency and keeps the statement link outside its transaction link', () => {
  render(<AccountRecords account={{ id: 'usd', currency: 'USD' } as Account} />);
  expect(screen.getByText(/US\$\s*5/)).toBeVisible();
  expect(screen.getByRole('link', { name: 'viewStatementEvidence' })).toHaveAttribute(
    'href',
    '/documents#document-statement',
  );
  expect(document.querySelector('a a')).toBeNull();
});
