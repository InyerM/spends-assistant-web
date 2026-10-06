import { AuthError, errorResponse, getAdminClient, getUserClient } from '@/lib/api/server';
import { removeOwnedStorage } from '@/lib/account-deletion/remove-owned-storage';

const privateHeaders = { 'Cache-Control': 'private, no-store' };

export async function POST(request: Request): Promise<Response> {
  try {
    const { supabase, userId, accessToken } = await getUserClient(request);
    if (!accessToken && request.headers.get('Origin') !== new URL(request.url).origin) {
      return errorResponse('Invalid request origin', 403);
    }

    const body = (await request.json()) as { confirmation?: unknown };
    if (typeof body.confirmation !== 'string' || body.confirmation.length > 320) {
      return errorResponse('Invalid confirmation', 400);
    }
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || data.user.id !== userId) return errorResponse('Unauthorized', 401);
    const expected = data.user.email?.trim().toLowerCase() ?? 'delete';
    if (body.confirmation.trim().toLowerCase() !== expected) {
      return errorResponse('Confirmation does not match', 400);
    }

    const admin = getAdminClient();
    const { data: ready, error: preflightError } = await admin.rpc('account_deletion_ready');
    if (preflightError || ready !== true) {
      return errorResponse('Account deletion is temporarily unavailable', 503);
    }
    await removeOwnedStorage(admin, userId);
    const { error: deletionError } = await admin.auth.admin.deleteUser(userId, false);
    if (deletionError) return errorResponse('Account deletion could not be completed', 503);
    return Response.json({ deleted: true }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Account deletion could not be completed', 503);
  }
}
