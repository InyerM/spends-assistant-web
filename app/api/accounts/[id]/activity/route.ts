import { z } from 'zod';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { supabase } = await getUserClient(request);
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return errorResponse('Invalid account', 400);
    const { data, error } = await supabase.rpc('account_activity', { p_account: id });
    if (error) return errorResponse('Account activity unavailable', 404);
    return Response.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return errorResponse(
      error instanceof AuthError ? 'Unauthorized' : 'Account activity unavailable',
      error instanceof AuthError ? 401 : 500,
    );
  }
}
