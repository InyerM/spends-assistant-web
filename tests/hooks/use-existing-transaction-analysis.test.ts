import { act, renderHook } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { expect, it, vi } from 'vitest';
import type { TransactionFormValues } from '@/lib/transactions/form-draft';
import type { Transaction } from '@/types';
import type { CategoryReview } from '@/lib/category-review';
const { mutation } = vi.hoisted(() => ({
  mutation: {
    mutate: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    data: undefined as CategoryReview | undefined,
  },
}));
vi.mock('next-intl', () => ({ useLocale: () => 'es' }));
vi.mock('@/lib/api/mutations/existing-transaction-review.mutations', () => ({
  useExistingTransactionReview: () => mutation,
}));
import { useExistingTransactionAnalysis } from '@/hooks/use-existing-transaction-analysis';
it('marks only reviewed fields pending and applies selected metadata without replacing newer edits', () => {
  const transaction = { id: 'tx', type: 'expense', account_id: 'bank' } as Transaction;
  const { result, rerender } = renderHook(() => {
    const form = useForm<TransactionFormValues>({
      defaultValues: {
        type: 'expense',
        account_id: 'bank',
        description: 'Original',
        notes: 'Old note',
        category_id: 'old',
        amount: 100,
      },
    });
    return { form, review: useExistingTransactionAnalysis(transaction, form, true) };
  });
  act(() => result.current.review.run());
  mutation.isPending = true;
  rerender();
  expect(result.current.review.fieldState('description')).toBe('analyzing');
  expect(result.current.review.fieldState('amount')).toBeUndefined();
  act(() => result.current.form.setValue('notes', 'My newer note'));
  const proposal = {
    description: 'Lunch',
    notes: 'AI note',
    category_id: 'food',
    kind: 'expense',
    explanation: 'Confirmed lunch',
    evidence_ids: [],
  } as CategoryReview;
  mutation.data = proposal;
  mutation.isPending = false;
  act(() => {
    mutation.mutate.mock.calls[0][1].onSuccess(proposal);
  });
  act(() => result.current.review.apply());
  expect(result.current.form.getValues()).toMatchObject({
    description: 'Lunch',
    notes: 'My newer note',
    category_id: 'food',
    account_id: 'bank',
    amount: 100,
  });
  expect(result.current.review.fieldState('description')).toBe('suggested');
});
