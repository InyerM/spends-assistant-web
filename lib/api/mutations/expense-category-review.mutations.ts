import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AiConsentRequiredError } from '@/lib/ai-consent';
import {
  analyzeExistingTransaction,
  TransactionAnalysisError,
} from './existing-transaction-review.mutations';
import type { ExpenseReviewResult, ExpenseReviewRow } from '@/types/expense-category-review';
interface AnalysisInput {
  ids: string[];
  locale: string;
}
export async function analyzeExpenseCategories({
  ids,
  locale,
}: AnalysisInput): Promise<ExpenseReviewResult[]> {
  if (!ids.length || ids.length > 5 || new Set(ids).size !== ids.length)
    throw new Error('Invalid review selection');
  const results: ExpenseReviewResult[] = [];
  let blocker: Error | undefined;
  for (let offset = 0; offset < ids.length; offset += 2) {
    const group = await Promise.all(
      ids.slice(offset, offset + 2).map(async (id) => {
        if (blocker) return { id, error: blocker };
        try {
          return { id, proposal: await analyzeExistingTransaction(id, { locale }) };
        } catch (error) {
          return { id, error: error instanceof Error ? error : new Error('Analysis unavailable') };
        }
      }),
    );
    results.push(...group);
    blocker ??= group.find(
      (row) =>
        row.error instanceof AiConsentRequiredError ||
        (row.error instanceof TransactionAnalysisError && row.error.status === 429),
    )?.error;
  }
  return results;
}
export function useAnalyzeExpenseCategories(): ReturnType<
  typeof useMutation<ExpenseReviewResult[], Error, AnalysisInput>
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: analyzeExpenseCategories,
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['usage'] });
    },
  });
}
export function useApplyExpenseCategory(): ReturnType<
  typeof useMutation<void, Error, { row: ExpenseReviewRow; categoryId: string }>
> {
  const client = useQueryClient();
  return useMutation({
    mutationKey: ['expense-category-review'],
    mutationFn: async ({ row, categoryId }) => {
      const response = await fetch(`/api/transactions/${row.id}/category-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_id: categoryId,
          expected: {
            category_id: row.category_id,
            description: row.description,
            notes: row.notes,
            account_id: row.account_id,
          },
        }),
      });
      if (!response.ok) throw new Error('Review changed; refresh before applying');
    },
    onSuccess: async () => {
      await Promise.all(
        [
          'transactions',
          'expense-category-review',
          'category-suggestions',
          'category-followup',
          'contacts',
          'contact-detail',
          'budgets',
          'dashboard',
        ].map((key) => client.invalidateQueries({ queryKey: [key] })),
      );
    },
  });
}
