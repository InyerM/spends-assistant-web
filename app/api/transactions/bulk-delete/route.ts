import type { NextRequest } from 'next/server';
import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { supabase } = await getUserClient();
    const body = (await request.json()) as { ids: string[] };

    if (
      !Array.isArray(body.ids) ||
      body.ids.length === 0 ||
      body.ids.length > 2000 ||
      body.ids.some((id) => typeof id !== 'string')
    ) {
      return errorResponse('Provide between 1 and 2000 transaction IDs', 400);
    }
    const { data, error } = await supabase.rpc('soft_delete_transactions', {
      p_transaction_ids: body.ids,
    });
    if (error) {
      const conflict =
        error.message === 'Reviewed transaction cannot be deleted' ||
        error.message === 'Transaction accounts changed during deletion';
      return errorResponse(error.message, conflict ? 409 : 400);
    }
    if (data === 0) return errorResponse('No transactions found', 404);
    return jsonResponse({ success: true, deletedCount: data });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to bulk delete transactions');
  }
}
