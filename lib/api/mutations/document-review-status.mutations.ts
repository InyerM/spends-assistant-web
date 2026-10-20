import { useMutation, useQueryClient } from '@tanstack/react-query';
export type DocumentReviewStatus = 'active' | 'completed' | 'no_movements';
export function useDocumentReviewStatus(
  id: string,
): ReturnType<typeof useMutation<void, Error, DocumentReviewStatus>> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (status) => {
      const response = await fetch(`/api/documents/${id}/review-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error('Document review unavailable');
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['documents'] }),
  });
}
