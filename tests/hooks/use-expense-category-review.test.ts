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
