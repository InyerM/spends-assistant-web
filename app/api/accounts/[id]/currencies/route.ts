import { z } from 'zod';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
import { hasSameRequestOrigin } from '@/lib/api/request-origin';
const schema = z.strictObject({ currency: z.enum(['COP', 'USD']) });
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
      return errorResponse('Invalid account currency', 400);
    const { data, error } = await supabase.rpc('enable_account_currency', {
      p_account: id,
      p_currency: body.data.currency,
    });
    if (error) return errorResponse('Account currency could not be enabled', 409);
    return Response.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return errorResponse(
      error instanceof AuthError
        ? error.status === 403
          ? 'Invalid request origin'
          : 'Unauthorized'
        : 'Account currency unavailable',
      error instanceof AuthError ? (error.status === 403 ? 403 : 401) : 500,
    );
  }
}
