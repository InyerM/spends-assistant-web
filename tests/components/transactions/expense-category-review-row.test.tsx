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
  expect(apply).toHaveBeenCalledWith({ category_id: 'streaming', description: 'Music' });
});

it('allows reviewing wording and notes without changing the category or posting facts', () => {
  const apply = vi.fn();
  render(
    <ExpenseCategoryReviewRow
      row={
        {
          id: 'tx',
          description: 'Original',
          notes: 'Keep my note',
          category_id: 'streaming',
          amount: 18500,
          date: '2026-10-19',
          currency: 'COP',
        } as ExpenseReviewRow
      }
      categories={[]}
      selected={false}
      disabled={false}
      analyzing={false}
      result={{
        id: 'tx',
        proposal: {
          category_id: 'streaming',
          description: 'Clear title',
          notes: 'Suggested note',
          explanation: 'Evidence.',
          kind: 'expense',
          evidence_ids: [],
        },
      }}
      onSelect={vi.fn()}
      onChoice={vi.fn()}
      onApply={apply}
    />,
  );
  fireEvent.change(screen.getByLabelText('descriptionField'), { target: { value: 'My title' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'applyNotes' }));
  fireEvent.click(screen.getByRole('button', { name: 'applyFor' }));
  expect(apply).toHaveBeenCalledWith({ description: 'My title' });
});

it('preserves edited description and notes when reanalysis returns another proposal', () => {
  const row = {
    id: 'tx',
    description: 'Original',
    notes: 'Original note',
    category_id: null,
    amount: 10,
    date: '2026-11-12',
    currency: 'COP',
  } as ExpenseReviewRow;
  const props = {
    row,
    categories: [],
    selected: false,
    disabled: false,
    analyzing: false,
    onSelect: vi.fn(),
    onChoice: vi.fn(),
    onApply: vi.fn(),
  };
  const proposal = {
    category_id: null,
    description: 'AI title',
    notes: 'AI note',
    explanation: 'Reason',
    kind: 'expense' as const,
    evidence_ids: [],
  };
  const { rerender } = render(
    <ExpenseCategoryReviewRow {...props} result={{ id: 'tx', proposal }} />,
  );
  fireEvent.change(screen.getByLabelText('descriptionField'), { target: { value: 'Human title' } });
  fireEvent.change(screen.getByLabelText('notesField'), { target: { value: 'Human note' } });
  rerender(
    <ExpenseCategoryReviewRow
      {...props}
      result={{ id: 'tx', proposal: { ...proposal, description: 'New AI', notes: 'New note' } }}
    />,
  );
  expect(screen.getByLabelText('descriptionField')).toHaveValue('Human title');
  expect(screen.getByLabelText('notesField')).toHaveValue('Human note');
});

it('explains a stale proposal and removes its apply controls', () => {
  render(
    <ExpenseCategoryReviewRow
      row={{ id: 'tx', description: 'Updated', date: '2026-11-12', amount: 10 } as ExpenseReviewRow}
      categories={[]}
      selected={false}
      disabled={false}
      analyzing={false}
      result={{ id: 'tx', stale: true }}
      onSelect={vi.fn()}
      onChoice={vi.fn()}
      onApply={vi.fn()}
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('staleProposal');
  expect(screen.queryByRole('button', { name: 'applyFor' })).not.toBeInTheDocument();
});
