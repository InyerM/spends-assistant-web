import type { NextRequest } from 'next/server';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';

interface Context {
  params: Promise<{ id: string }>;
}

const reviewStatuses = new Set(['pending', 'non_transaction', 'dismissed']);

export async function PATCH(request: NextRequest, context: Context): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();
    const { id } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(id)) {
      return errorResponse('Invalid inbox item ID', 400);
    }
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return errorResponse('Invalid JSON', 400);
    }
    const status =
      input && typeof input === 'object' && !Array.isArray(input)
        ? (input as Record<string, unknown>).status
        : null;
    if (typeof status !== 'string' || !reviewStatuses.has(status)) {
      return errorResponse('Invalid review status', 400);
    }
    const { data, error } = await supabase
      .from('shortcut_inbox_items')
      .update({ status })
      .eq('id', id)
      .eq('user_id', userId)
      .select('id,status')
      .maybeSingle();
    if (error?.code === '23514') return errorResponse('Inbox item is already matched', 409);
    if (error) return errorResponse('Inbox review failed');
    if (!data) return errorResponse('Inbox item not found', 404);
    return Response.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Inbox review failed');
  }
}
