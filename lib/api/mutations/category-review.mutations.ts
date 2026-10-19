import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aiConsentErrorFromResponse } from '@/lib/ai-consent';
import type { CategoryReview } from '@/lib/category-review';
interface ExplainInput {
  locale: string;
  target_id?: string;
  description?: string;
  notes?: string;
}
export function useExplainCategoryReview(
  id: string | null,
): ReturnType<typeof useMutation<CategoryReview, Error, ExplainInput>> {
  return useMutation({
    mutationFn: async (body: ExplainInput): Promise<CategoryReview> => {
      const response = await fetch(`/api/transactions/${id}/category-followup/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok)
        throw (
          (await aiConsentErrorFromResponse(response)) ??
          new Error('Review explanation unavailable')
        );
      return response.json() as Promise<CategoryReview>;
    },
  });
}
export interface CategoryReviewPatch {
  id: string;
  category_id: string;
  description: string;
  notes: string | null;
  expected_category_id: string | null;
  expected_description: string;
  expected_notes: string | null;
}
interface SaveInput {
  source_category_id: string;
  targets: CategoryReviewPatch[];
}
export function useSaveCategoryReview(
  id: string | null,
): ReturnType<typeof useMutation<void, Error, SaveInput>> {
  const client = useQueryClient();
  return useMutation({
    mutationKey: ['category-review'],
    mutationFn: async (body: SaveInput): Promise<void> => {
      const response = await fetch(`/api/transactions/${id}/category-followup/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Review changed');
    },
    onSuccess: async () => {
      await Promise.all(
        [
          'transactions',
          'category-followup',
          'category-suggestions',
          'contacts',
          'contact-detail',
          'budgets',
        ].map((key) => client.invalidateQueries({ queryKey: [key] })),
      );
    },
  });
}
