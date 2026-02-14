import type { NextRequest } from 'next/server';
import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';

export async function PATCH(request: NextRequest): Promise<Response> {
  try {
    const { supabase } = await getUserClient();
    const body = (await request.json()) as {
      ids: string[];
      updates: Record<string, unknown>;
    };

    if (!body.ids.length || Object.keys(body.updates).length === 0) {
      return errorResponse('ids and updates are required', 400);
    }

    const { data, error } = await supabase
      .from('transactions')
      .update(body.updates)
      .in('id', body.ids)
      .is('deleted_at', null)
      .select();

    if (error) return errorResponse(error.message, 400);
    return jsonResponse(data);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to bulk update transactions');
  }
}
