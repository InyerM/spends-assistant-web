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
