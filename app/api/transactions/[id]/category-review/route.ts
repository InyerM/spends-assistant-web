import { z } from 'zod';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
import { hasSameRequestOrigin } from '@/lib/api/request-origin';
const schema = z
  .strictObject({
    category_id: z.uuid().optional(),
    changes: z
      .strictObject({
        category_id: z.uuid().optional(),
        description: z.string().trim().min(1).max(500).optional(),
        notes: z.string().max(1500).nullable().optional(),
      })
      .refine((value) => Object.keys(value).length > 0)
      .optional(),
    expected: z.strictObject({
      category_id: z.uuid().nullable(),
      description: z.string(),
      notes: z.string().nullable(),
      account_id: z.uuid(),
    }),
  })
  .refine((value) => Boolean(value.category_id) !== Boolean(value.changes));
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
    const { error } = body.data.changes
      ? await supabase.rpc('review_expense_metadata', {
          p_transaction: id,
          p_changes: body.data.changes,
          p_expected: body.data.expected,
        })
      : await supabase.rpc('review_expense_category', {
          p_transaction: id,
          p_category: body.data.category_id,
          p_expected: body.data.expected,
        });
    if (error) return errorResponse('Review changed; refresh before applying', 409);
    return Response.json({ updated: true });
  } catch (error) {
    return errorResponse(
      error instanceof AuthError
        ? error.status === 403
          ? 'Invalid request origin'
          : 'Unauthorized'
        : 'Review unavailable',
      error instanceof AuthError ? (error.status === 403 ? 403 : 401) : 503,
    );
  }
}
