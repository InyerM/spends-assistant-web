import { z } from 'zod';
import { hasSameRequestOrigin } from '@/lib/api/request-origin';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
const schema = z.strictObject({
  category_id: z.uuid(),
  targets: z
    .array(z.strictObject({ id: z.uuid(), category_id: z.uuid().nullable() }))
    .min(1)
    .max(100),
});
interface Context {
  params: Promise<{ id: string }>;
}
export async function GET(request: Request, { params }: Context): Promise<Response> {
  try {
    const { supabase } = await getUserClient(request);
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return errorResponse('Invalid transaction', 400);
    const { data, error } = await supabase.rpc('counterparty_category_followup', {
      p_transaction: id,
    });
    if (error) return errorResponse('Category history unavailable', 404);
    return Response.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return errorResponse(
      error instanceof AuthError ? 'Unauthorized' : 'Category history unavailable',
      error instanceof AuthError ? 401 : 500,
    );
  }
}
export async function POST(request: Request, { params }: Context): Promise<Response> {
  try {
    const { supabase, accessToken } = await getUserClient(request);
    if (!accessToken && !hasSameRequestOrigin(request))
      return errorResponse('Invalid request origin', 403);
    const { id } = await params;
    const body = schema.safeParse(await request.json().catch(() => null));
    if (!z.uuid().safeParse(id).success || !body.success)
      return errorResponse('Invalid category review', 400);
    const { data, error } = await supabase.rpc('apply_counterparty_category_followup', {
      p_transaction: id,
      p_category: body.data.category_id,
      p_targets: body.data.targets,
    });
    if (error) return errorResponse('Category history changed; refresh before applying', 409);
    return Response.json({ updated: data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return errorResponse(
      error instanceof AuthError
        ? error.status === 403
          ? 'Invalid request origin'
          : 'Unauthorized'
        : 'Category update failed',
      error instanceof AuthError ? (error.status === 403 ? 403 : 401) : 500,
    );
  }
}
