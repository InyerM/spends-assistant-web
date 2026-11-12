import { z } from 'zod';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
import { hasSameRequestOrigin } from '@/lib/api/request-origin';
const schema = z.strictObject({
  source_category_id: z.uuid(),
  targets: z
    .array(
      z.strictObject({
        id: z.uuid(),
        category_id: z.uuid(),
        description: z.string().trim().min(1).max(10000),
        notes: z.string().max(20000).nullable(),
        expected_category_id: z.uuid().nullable(),
        expected_description: z.string(),
        expected_notes: z.string().nullable(),
      }),
    )
    .min(1)
    .max(100),
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
    const { data, error } = await supabase.rpc('apply_counterparty_review', {
      p_source: id,
      p_source_category: body.data.source_category_id,
      p_targets: body.data.targets,
    });
    if (error) return errorResponse('Review changed; refresh before applying', 409);
    return Response.json({ updated: data });
  } catch (error) {
    return errorResponse(
      error instanceof AuthError
        ? error.status === 403
          ? 'Invalid request origin'
          : 'Unauthorized'
        : 'Review unavailable',
      error instanceof AuthError ? (error.status === 403 ? 403 : 401) : 500,
    );
  }
}
