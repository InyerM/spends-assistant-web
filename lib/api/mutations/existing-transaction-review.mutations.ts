import { useMutation } from '@tanstack/react-query';
import { aiConsentErrorFromResponse } from '@/lib/ai-consent';
import type { CategoryReview } from '@/lib/category-review';
interface ReviewInput {
  locale: string;
  description?: string;
  notes?: string;
  type?: string;
  account_id?: string;
}
export class TransactionAnalysisError extends Error {
  public constructor(public readonly status: number) {
    super('Transaction analysis unavailable');
    this.name = 'TransactionAnalysisError';
  }
}
export async function analyzeExistingTransaction(
  id: string,
  body: ReviewInput,
): Promise<CategoryReview> {
  const response = await fetch(`/api/transactions/${id}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok)
    throw (
      (await aiConsentErrorFromResponse(response)) ?? new TransactionAnalysisError(response.status)
    );
  return response.json() as Promise<CategoryReview>;
}
export function useExistingTransactionReview(
  id: string | undefined,
): ReturnType<typeof useMutation<CategoryReview, Error, ReviewInput>> {
  return useMutation({
    mutationFn: (body: ReviewInput) => analyzeExistingTransaction(id ?? '', body),
  });
}
