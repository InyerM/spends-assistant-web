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
    onSuccess: async () => {
      await Promise.all(
        ['documents', 'transactions', 'accounts', 'budgets', 'usage'].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      );
    },
  });
}
