import { workerConfig } from '@/lib/config';
import { forwardAiConsentError } from '@/lib/ai-consent';
import { categoryReviewSchema, type CategoryReview } from '@/lib/category-review';
export async function requestCategoryReview(
  token: string,
  input: Record<string, unknown>,
): Promise<CategoryReview | Response> {
  const response = await fetch(`${workerConfig.url}/category/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok)
    return (
      (await forwardAiConsentError(response)) ??
      Response.json(
        { error: 'Category review unavailable' },
        { status: response.status === 429 ? 429 : 503 },
      )
    );
  const parsed = categoryReviewSchema.safeParse(await response.json());
  if (!parsed.success)
    return Response.json({ error: 'Invalid category proposal' }, { status: 503 });
  return parsed.data;
}
