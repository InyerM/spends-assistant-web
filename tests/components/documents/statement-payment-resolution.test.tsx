import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Account } from '@/types';
const { analyze } = vi.hoisted(() => ({ analyze: vi.fn() }));
vi.mock('next-intl', () => ({
  useLocale: () => 'es',
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/lib/api/queries/category.queries', () => ({
  useCategories: () => ({
    data: [{ id: 'refund', slug: 'refunds', type: 'income', name: 'Refunds' }],
  }),
}));
vi.mock('@/lib/api/mutations/statement.mutations', () => ({
  useAnalyzeStatementMovement: () => ({ mutate: analyze, isPending: false }),
  useCreateStatementTransaction: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/components/shared/searchable-select', () => ({
  SearchableSelect: () => <div>category</div>,
}));
vi.mock('@/components/accounts/account-create-dialog', () => ({ AccountCreateDialog: () => null }));
import { StatementCreateDialog } from '@/components/documents/statement-create-dialog';
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const accounts = [
  { id: 'card', type: 'credit_card', name: 'Card', currency: 'USD', is_active: true },
  { id: 'bank', type: 'checking', name: 'Bank', currency: 'USD', is_active: true },
] as Account[];
function open(input = accounts) {
  render(
    <StatementCreateDialog
      documentId='doc'
      row={{
        id: 'row',
        description: 'ABONO SUCURSAL VIRTUAL',
        amount: 5,
        currency: 'USD',
        occurred_at_text: '2026-09-01',
        status: 'pending',
      }}
      accounts={input}
      account='card'
      disabled={false}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'createMissing' }));
}
it('uses one payment choice and updates automatic wording when switching from a refund to a payment', () => {
  open();
  fireEvent.click(screen.getByRole('button', { name: 'confirmRefund' }));
  expect(screen.getByDisplayValue('refundDescription')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'confirmOwnPayment' }));
  expect(screen.getByDisplayValue('cardPaymentDescription')).toBeVisible();
  expect(screen.queryByRole('checkbox', { name: 'ownTransfer' })).not.toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'otherAccount' })).toBeEnabled();
});
it('keeps a payment decision and manually written description when AI finishes late', async () => {
  open();
  fireEvent.click(screen.getByRole('button', { name: 'confirmOwnPayment' }));
  await act(() =>
    analyze.mock.calls[0][1].onSuccess({
      kind: 'own_transfer',
      description: 'Uncertain AI title',
      category_id: null,
    }),
  );
  expect(screen.getByDisplayValue('cardPaymentDescription')).toBeVisible();
  fireEvent.change(screen.getByDisplayValue('cardPaymentDescription'), {
    target: { value: 'My own payment' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'confirmRefund' }));
  expect(screen.getByDisplayValue('My own payment')).toBeVisible();
});
it('offers currency setup instead of an empty source-account dropdown', () => {
  open(accounts.slice(0, 1));
  fireEvent.click(screen.getByRole('button', { name: 'confirmOwnPayment' }));
  expect(screen.queryByRole('combobox', { name: 'otherAccount' })).not.toBeInTheDocument();
  expect(screen.getByText('noCurrencyAccounts')).toBeVisible();
  expect(screen.getByRole('button', { name: 'setupCurrency' })).toBeEnabled();
});
