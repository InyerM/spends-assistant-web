import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  analyze: { mutate: vi.fn(), isPending: false, reset: vi.fn() },
  save: { mutate: vi.fn(), isPending: false, reset: vi.fn() },
  queue: { data: { data: [], count: 0 } },
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'es',
  useTranslations: () => (key: string) => key,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
vi.mock('@/lib/api/queries/expense-category-review.queries', () => ({
  useExpenseCategoryQueue: () => mocks.queue,
}));
vi.mock('@/lib/api/mutations/expense-category-review.mutations', () => ({
  useAnalyzeExpenseCategories: () => mocks.analyze,
  useApplyExpenseCategory: () => mocks.save,
}));
import { useExpenseCategoryReview } from '@/hooks/use-expense-category-review';
it('bounds selection and requires a separate category confirmation after receiving AI proposals', () => {
  const { result } = renderHook(() => useExpenseCategoryReview());
  act(() => {
    for (let i = 0; i < 6; i++) result.current.toggle(String(i));
  });
  expect(result.current.selected).toHaveLength(5);
  act(() => result.current.analyze());
  expect(mocks.analyze.mutate.mock.calls[0][0]).toEqual({
    ids: ['0', '1', '2', '3', '4'],
    locale: 'es',
  });
  const proposal = {
    category_id: 'streaming',
    description: 'Music',
    notes: '',
    explanation: 'Music subscription',
    kind: 'expense',
    evidence_ids: [],
  };
  act(() => {
    mocks.analyze.mutate.mock.calls[0][1].onSuccess([{ id: '0', proposal }]);
  });
  expect(result.current.reviews['0']?.proposal?.explanation).toBe('Music subscription');
  expect(mocks.save.mutate).not.toHaveBeenCalled();
  act(() => result.current.changeFilters({ scope: 'all' }));
  expect(result.current.selected).toHaveLength(0);
  expect(result.current.filters.scope).toBe('all');
});

it('binds proposals to the analyzed snapshot and rejects a changed queue row', () => {
  mocks.analyze.mutate.mockClear();
  mocks.save.mutate.mockClear();
  const row = {
    id: 'tx',
    description: 'Original',
    notes: null,
    category_id: null,
    account_id: 'account',
    type: 'expense',
    amount: 10,
    date: '2026-11-12',
    currency: 'COP',
  };
  mocks.queue.data.data = [row] as never[];
  const { result, rerender } = renderHook(() => useExpenseCategoryReview());
  act(() => result.current.toggle('tx'));
  act(() => result.current.analyze());
  void act(() =>
    mocks.analyze.mutate.mock.calls[0][1].onSuccess([
      {
        id: 'tx',
        proposal: {
          description: 'AI',
          notes: '',
          kind: 'expense',
          category_id: null,
          explanation: 'Reason',
          evidence_ids: [],
        },
      },
    ]),
  );
  act(() => result.current.setChoice('tx', 'chosen'));
  act(() => result.current.toggle('tx'));
  act(() => result.current.analyze());
  void act(() =>
    mocks.analyze.mutate.mock.calls[1][1].onSuccess([
      {
        id: 'tx',
        proposal: {
          description: 'New AI',
          notes: '',
          kind: 'expense',
          category_id: null,
          explanation: 'Reason',
          evidence_ids: [],
        },
      },
    ]),
  );
  expect(result.current.choices.tx).toBe('chosen');
  const changed = { ...row, description: 'Human update' };
  mocks.queue.data.data = [changed] as never[];
  rerender();
  expect(result.current.reviews.tx?.proposal).toBeUndefined();
  expect(result.current.reviews.tx?.stale).toBe(true);
  act(() => result.current.apply(changed as never, { description: 'AI' }));
  expect(mocks.save.mutate).not.toHaveBeenCalled();
});

it('does not rebase a proposal when a transaction changes while analysis is pending', () => {
  mocks.analyze.mutate.mockClear();
  mocks.save.mutate.mockClear();
  const row = {
    id: 'tx',
    description: 'Original',
    notes: null,
    category_id: null,
    account_id: 'account',
    type: 'expense',
    amount: 10,
    date: '2026-11-12',
    currency: 'COP',
  };
  mocks.queue.data.data = [row] as never[];
  const { result, rerender } = renderHook(() => useExpenseCategoryReview());
  act(() => result.current.toggle('tx'));
  act(() => result.current.analyze());
  mocks.queue.data.data = [{ ...row, notes: 'New human note' }] as never[];
  rerender();
  void act(() =>
    mocks.analyze.mutate.mock.calls[0][1].onSuccess([
      {
        id: 'tx',
        proposal: {
          description: 'AI',
          notes: '',
          kind: 'expense',
          category_id: null,
          explanation: 'Reason',
          evidence_ids: [],
        },
      },
    ]),
  );
  expect(result.current.reviews.tx?.stale).toBe(true);
  act(() => result.current.apply(row as never, { description: 'AI' }));
  expect(mocks.save.mutate).not.toHaveBeenCalled();
});

it.each([false, true])(
  'keeps the prior editor after failed reanalysis without rebasing it (changed=%s)',
  (changed) => {
    mocks.analyze.mutate.mockClear();
    const row = {
      id: 'tx',
      description: 'Original',
      notes: null,
      category_id: null,
      account_id: 'account',
      type: 'expense',
      amount: 10,
      date: '2026-11-12',
      currency: 'COP',
    };
    mocks.queue.data.data = [row] as never[];
    const { result, rerender } = renderHook(() => useExpenseCategoryReview());
    const proposal = {
      description: 'AI',
      notes: '',
      kind: 'expense',
      category_id: null,
      explanation: 'Reason',
      evidence_ids: [],
    };
    act(() => result.current.toggle('tx'));
    act(() => result.current.analyze());
    act(() => {
      mocks.analyze.mutate.mock.calls[0][1].onSuccess([{ id: 'tx', proposal }]);
    });
    if (changed) {
      mocks.queue.data.data = [{ ...row, notes: 'Human update' }] as never[];
      rerender();
    }
    act(() => result.current.toggle('tx'));
    act(() => result.current.analyze());
    const error = new Error('Provider unavailable');
    act(() => {
      mocks.analyze.mutate.mock.calls[1][1].onSuccess([{ id: 'tx', error }]);
    });
    if (changed) {
      expect(result.current.reviews.tx?.stale).toBe(true);
      expect(result.current.reviews.tx?.proposal).toBeUndefined();
    } else {
      expect(result.current.reviews.tx?.proposal).toBe(proposal);
      expect(result.current.reviews.tx?.error).toBe(error);
      expect(result.current.reviews.tx?.baseline).toEqual(row);
    }
  },
);
