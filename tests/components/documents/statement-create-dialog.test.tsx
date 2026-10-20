import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const { analyze, create } = vi.hoisted(() => ({ analyze: vi.fn(), create: vi.fn() }));
vi.mock('next-intl', () => ({
  useLocale: () => 'es',
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/lib/api/queries/category.queries', () => ({ useCategories: () => ({ data: [] }) }));
vi.mock('@/components/shared/searchable-select', () => ({
  SearchableSelect: ({
    value,
    onValueChange,
  }: {
    value: string;
    onValueChange: (s: string) => void;
  }) => (
    <input
      aria-label='category'
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    />
  ),
}));
vi.mock('@/lib/api/mutations/statement.mutations', () => ({
  useAnalyzeStatementMovement: () => ({ mutate: analyze, isPending: false }),
  useCreateStatementTransaction: () => ({ mutate: create, isPending: false }),
}));
import { StatementCreateDialog } from '@/components/documents/statement-create-dialog';
afterEach(cleanup);
it('analyzes when opened, fills category and preserves a description edited while waiting', async () => {
  render(
    <StatementCreateDialog
      documentId='doc'
      row={{
        id: 'row',
        description: 'Original',
        amount: -100,
        currency: 'COP',
        occurred_at_text: '2026-09-01',
        status: 'pending',
      }}
      accounts={[]}
      account='bank'
      disabled={false}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'createMissing' }));
  expect(analyze).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByDisplayValue('Original'), {
    target: { value: 'My reviewed description' },
  });
  await act(() =>
    analyze.mock.calls[0][1].onSuccess({
      category_id: 'food',
      description: 'AI text',
      source: 'ai',
    }),
  );
  expect(screen.getByLabelText('category')).toHaveValue('food');
  expect(screen.getByDisplayValue('My reviewed description')).toBeVisible();
  expect(create).not.toHaveBeenCalled();
});
it('requires a card payment explanation before a positive card entry can become income', () => {
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
      accounts={[{ id: 'card', type: 'credit_card', currency: 'USD', is_active: true } as never]}
      account='card'
      disabled={false}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'createMissing' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'createConfirmation' }));
  expect(screen.getByRole('button', { name: 'createAndReconcile' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'confirmOtherIncome' }));
  expect(screen.getByRole('button', { name: 'createAndReconcile' })).toBeEnabled();
});
it('explains a movement outside the reviewed statement period and blocks posting before a server error', () => {
  render(
    <StatementCreateDialog
      documentId='doc'
      row={{
        id: 'row',
        description: 'Fee',
        amount: -5,
        currency: 'USD',
        occurred_at_text: '2026-09-01',
        status: 'pending',
      }}
      accounts={[]}
      account='card'
      disabled={false}
      period={{ start: '2026-08-01', end: '2026-08-31' }}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'createMissing' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'createConfirmation' }));
  expect(screen.getByRole('button', { name: 'createAndReconcile' })).toBeDisabled();
  expect(screen.getByText('outsidePeriod')).toBeVisible();
});
