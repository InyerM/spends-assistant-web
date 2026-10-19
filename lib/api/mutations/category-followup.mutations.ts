import { useMutation, useQueryClient } from '@tanstack/react-query';
export function useApplyCategoryFollowup(
  id: string | null,
): ReturnType<
  typeof useMutation<
    void,
    Error,
    { category_id: string; targets: Array<{ id: string; category_id: string | null }> }
  >
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      const response = await fetch(`/api/transactions/${id}/category-followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Category history changed');
    },
    onSuccess: async () => {
      await Promise.all(
        [
          'transactions',
          'contacts',
          'contact-detail',
          'budgets',
          'category-followup',
          'category-suggestions',
        ].map((key) => client.invalidateQueries({ queryKey: [key] })),
      );
    },
  });
}
