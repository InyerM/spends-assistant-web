import { z } from 'zod';
import { getUserClient, AuthError, errorResponse } from '@/lib/api/server';
import { hasSameRequestOrigin } from '@/lib/api/request-origin';
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { supabase, accessToken } = await getUserClient(request);
    if (!accessToken && !hasSameRequestOrigin(request))
      return errorResponse('Invalid request origin', 403);
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return errorResponse('Invalid transaction ID', 400);
    const body = z
      .strictObject({ action: z.literal('keep') })
      .safeParse(await request.json().catch(() => null));
    if (!body.success) return errorResponse('Invalid duplicate review', 400);
    const { error } = await supabase.rpc('confirm_transaction_not_duplicate', {
      p_transaction: id,
    });
    if (error)
      return errorResponse('Duplicate review unavailable', error.code === 'P0002' ? 404 : 409);
    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(
      error instanceof AuthError
        ? error.status === 403
          ? 'Invalid request origin'
          : 'Unauthorized'
        : 'Duplicate review unavailable',
      error instanceof AuthError ? (error.status === 403 ? 403 : 401) : 503,
    );
  }
}
