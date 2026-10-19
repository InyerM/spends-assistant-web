import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
const { save, asyncSave } = vi.hoisted(() => ({ save: vi.fn(), asyncSave: vi.fn() }));
vi.mock('next-intl', () => ({
  useLocale: () => 'es',
  useTranslations: () => (key: string, values?: { count?: number }) =>
    values?.count !== undefined ? `${key} ${values.count}` : key,
}));
vi.mock('@/lib/api/mutations/category-review.mutations', () => ({
  useSaveCategoryReview: () => ({
    mutate: save,
    mutateAsync: asyncSave.mockImplementation((body) => {
      save(body);
      return Promise.resolve();
    }),
    isPending: false,
  }),
  useExplainCategoryReview: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/components/shared/searchable-select', () => ({
  SearchableSelect: ({
    value,
    onValueChange,
    ariaLabel,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    ariaLabel: string;
  }) => (
    <input aria-label={ariaLabel} value={value} onChange={(e) => onValueChange(e.target.value)} />
  ),
}));
import { CategoryReviewEditor } from '@/components/transactions/category-review-editor';
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('shows source notes and allows a row-specific category and wording before an explicit save', () => {
  render(
    <CategoryReviewEditor
      sourceId='source'
      data={{
        contact_name: 'Shop',
        category_id: 'food',
        category_name: 'Food',
        source: { id: 'source', type: 'expense', description: 'Lunch', notes: 'Lunches' },
        evidence: [
          {
            id: 'source',
            description: 'Lunch',
            notes: 'Confirmed lunches',
            category_id: 'food',
            category_name: 'Food',
          },
        ],
        rows: [
          {
            id: 'target',
            category_id: null,
            category_name: null,
            date: '2026-10-01',
            amount: 50,
            currency: 'COP',
            description: 'Bank transfer',
            notes: null,
          },
        ],
      }}
      categories={[]}
      onComplete={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByText('basisTitle 1'));
  expect(screen.getByText('Confirmed lunches')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'editMovement' }));
  fireEvent.change(screen.getByLabelText('categoryLabel'), { target: { value: 'gift' } });
  fireEvent.change(screen.getByLabelText('descriptionLabel'), {
    target: { value: 'Birthday gift' },
  });
  fireEvent.change(screen.getByLabelText('notesLabel'), { target: { value: 'Different purpose' } });
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'saveReviewed 1' }));
  expect(save.mock.calls[0][0]).toEqual({
    source_category_id: 'food',
    targets: [
      {
        id: 'target',
        category_id: 'gift',
        description: 'Birthday gift',
        notes: 'Different purpose',
        expected_category_id: null,
        expected_description: 'Bank transfer',
        expected_notes: null,
      },
    ],
  });
});

it('finishes closing the review after refreshed suggestions unmount the editor', async () => {
  const complete = vi.fn();
  let finish: () => void = () => undefined;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const view = render(
    <CategoryReviewEditor
      sourceId='source'
      data={{
        contact_name: 'Shop',
        category_id: 'food',
        category_name: 'Food',
        rows: [
          {
            id: 'target',
            category_id: null,
            category_name: null,
            date: '2026-10-01',
            amount: 50,
            currency: 'COP',
            description: 'Bank transfer',
            notes: null,
          },
        ],
      }}
      categories={[]}
      onComplete={complete}
    />,
  );
  asyncSave.mockReturnValueOnce(pending);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'saveReviewed 1' }));
  view.unmount();
  await act(async () => {
    finish();
    await pending;
  });
  expect(complete).toHaveBeenCalledOnce();
});
