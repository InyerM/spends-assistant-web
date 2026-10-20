import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ExpenseReviewRow } from '@/types/expense-category-review';
vi.mock('next-intl', () => ({
  useLocale: () => 'es',
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/components/shared/searchable-select', () => ({
  SearchableSelect: ({
    value,
    onValueChange,
  }: {
    value: string;
    onValueChange: (v: string) => void;
  }) => (
    <select aria-label='proposed' value={value} onChange={(e) => onValueChange(e.target.value)}>
      <option value='streaming'>Streaming</option>
      <option value='food'>Food</option>
    </select>
  ),
}));
import { ExpenseCategoryReviewRow } from '@/components/transactions/expense-category-review-row';
afterEach(cleanup);
it('shows the AI reason, allows a different category, and writes only after explicit apply', () => {
  const apply = vi.fn(),
    change = vi.fn();
  const row = {
    id: 'tx',
    description: 'Spotify',
    date: '2026-10-19',
    amount: 18500,
    currency: 'COP',
    category_id: null,
  } as ExpenseReviewRow;
  render(
    <ExpenseCategoryReviewRow
      row={row}
      categories={[]}
      selected={false}
      disabled={false}
      analyzing={false}
      result={{
        id: 'tx',
        proposal: {
          category_id: 'streaming',
          description: 'Music',
          notes: '',
          explanation: 'Identified music subscription.',
          kind: 'expense',
          evidence_ids: [],
        },
      }}
      choice='streaming'
      onSelect={vi.fn()}
      onChoice={change}
      onApply={apply}
    />,
  );
  expect(screen.getByText('Identified music subscription.')).toBeVisible();
  expect(apply).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('proposed'), { target: { value: 'food' } });
  expect(change).toHaveBeenCalledWith('food');
  fireEvent.click(screen.getByRole('button', { name: 'applyFor' }));
  expect(apply).toHaveBeenCalledWith('streaming');
});
