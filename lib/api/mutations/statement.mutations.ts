import { useCategoryFollowupStore } from '@/lib/stores/category-followup.store';
import { aiConsentErrorFromResponse } from '@/lib/ai-consent';
import { useMutation, useQueryClient } from '@tanstack/react-query';
export function useSaveStatementReconciliation(
  documentId: string,
): ReturnType<typeof useMutation<void, Error, Record<string, string>>> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      const response = await fetch(`/api/documents/${documentId}/reconciliation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Reconciliation failed');
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['documents'] }),
        client.invalidateQueries({ queryKey: ['transactions'] }),
      ]);
    },
  });
}

export interface StatementCreationInput {
  request_id: string;
  observation_id: string;
  category_id: string | null;
  description: string;
  transfer_account_id?: string | null;
}
export function useCreateStatementTransaction(
  documentId: string,
): ReturnType<typeof useMutation<{ transaction_id: string }, Error, StatementCreationInput>> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      const response = await fetch(`/api/documents/${documentId}/reconciliation/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const result = (await response.json()) as { code?: string };
        throw new Error(result.code ?? 'STATEMENT_REVIEW_REQUIRED');
      }
      return response.json() as Promise<{ transaction_id: string }>;
    },
    onSuccess: async (result) => {
      useCategoryFollowupStore.getState().offer(result.transaction_id);
      await Promise.all(
        [
          'category-suggestions',
          'contacts',
          'documents',
          'transactions',
          'accounts',
          'budgets',
          'usage',
        ].map((key) => client.invalidateQueries({ queryKey: [key] })),
      );
    },
  });
}

import type { CategoryReview } from '@/lib/category-review';
export type StatementAnalysis = CategoryReview & {
  source: 'automation' | 'ai' | 'evidence';
  reason_code: string;
};
export function useAnalyzeStatementMovement(
  documentId: string,
  observationId: string,
  accountId?: string,
  locale = 'es',
): ReturnType<typeof useMutation<StatementAnalysis, Error, void>> {
  return useMutation({
    mutationFn: async (): Promise<StatementAnalysis> => {
      const response = await fetch(
        `/api/documents/${documentId}/observations/${observationId}/analyze`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account_id: accountId, locale }),
        },
      );
      if (!response.ok)
        throw (await aiConsentErrorFromResponse(response)) ?? new Error('Analysis unavailable');
      return response.json() as Promise<StatementAnalysis>;
    },
  });
}
