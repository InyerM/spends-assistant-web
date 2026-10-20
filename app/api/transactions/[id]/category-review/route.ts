import { z } from 'zod';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
import { hasSameRequestOrigin } from '@/lib/api/request-origin';
const schema = z.strictObject({
  category_id: z.uuid(),
  expected: z.strictObject({
    category_id: z.uuid().nullable(),
    description: z.string(),
    notes: z.string().nullable(),
    account_id: z.uuid(),
  }),
});
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { supabase, accessToken } = await getUserClient(request);
    if (!accessToken && !hasSameRequestOrigin(request))
      return errorResponse('Invalid request origin', 403);
    const { id } = await params;
    const body = schema.safeParse(await request.json().catch(() => null));
    if (!z.uuid().safeParse(id).success || !body.success)
      return errorResponse('Invalid category review', 400);
    const { error } = await supabase.rpc('review_expense_category', {
      p_transaction: id,
      p_category: body.data.category_id,
      p_expected: body.data.expected,
    });
    if (error) return errorResponse('Review changed; refresh before applying', 409);
    return Response.json({ updated: true });
  } catch (error) {
    return errorResponse(
      error instanceof AuthError ? 'Unauthorized' : 'Review unavailable',
      error instanceof AuthError ? 401 : 503,
    );
  }
}
