import { useMutation } from '@tanstack/react-query';
import { aiConsentErrorFromResponse } from '@/lib/ai-consent';
import type { CategoryReview } from '@/lib/category-review';
interface ReviewInput {
  locale: string;
  description: string;
  notes: string;
  type: string;
  account_id: string;
}
export function useExistingTransactionReview(
  id: string | undefined,
): ReturnType<typeof useMutation<CategoryReview, Error, ReviewInput>> {
  return useMutation({
    mutationFn: async (body: ReviewInput): Promise<CategoryReview> => {
      const response = await fetch(`/api/transactions/${id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok)
        throw (
          (await aiConsentErrorFromResponse(response)) ??
          new Error('Transaction analysis unavailable')
        );
      return response.json() as Promise<CategoryReview>;
    },
  });
}
