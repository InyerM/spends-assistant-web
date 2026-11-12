import { z } from 'zod';
import { getUserClient, AuthError, errorResponse } from '@/lib/api/server';
import { hasSameRequestOrigin } from '@/lib/api/request-origin';
import { requestCategoryReview } from '@/lib/api/category-review-server';
import type { CategoryFollowup } from '@/lib/api/queries/category-followup.queries';
const schema = z.strictObject({
  locale: z.enum(['es', 'en', 'pt']),
  target_id: z.uuid().optional(),
  description: z.string().max(500).optional(),
  notes: z.string().max(1500).optional(),
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
      return errorResponse('Invalid review', 400);
    const context = await supabase.rpc('counterparty_category_followup', { p_transaction: id });
    const data = context.data as CategoryFollowup | null;
    if (context.error || !data?.source) return errorResponse('Review context not found', 404);
    const row = body.data.target_id
      ? data.rows.find((r) => r.id === body.data.target_id)
      : data.source;
    if (!row) return errorResponse('Contact movement not found', 404);
    const token = accessToken ?? (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return errorResponse('Unauthorized', 401);
    const proposal = await requestCategoryReview(token, {
      transaction_id: row.id,
      locale: body.data.locale,
      type: data.source.type,
      category_id: data.category_id,
      description: (body.data.description ?? row.description).slice(0, 500),
      notes: (body.data.notes ?? row.notes ?? '').slice(0, 1500),
      history: (data.evidence ?? []).map((r) => ({
        id: r.id,
        description: r.description.slice(0, 500),
        notes: r.notes?.slice(0, 1500),
        category: r.category_name,
      })),
    });
    return proposal instanceof Response
      ? proposal
      : Response.json(proposal, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return errorResponse(
      error instanceof AuthError
        ? error.status === 403
          ? 'Invalid request origin'
          : 'Unauthorized'
        : 'Review explanation unavailable',
      error instanceof AuthError ? (error.status === 403 ? 403 : 401) : 503,
    );
  }
}
