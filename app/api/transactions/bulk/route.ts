import type { NextRequest } from 'next/server';
import { getAdminClient, jsonResponse, errorResponse } from '@/lib/api/server';

export async function PATCH(request: NextRequest): Promise<Response> {
  try {
    const supabase = getAdminClient();
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
      .select();

    if (error) return errorResponse(error.message, 400);
    return jsonResponse(data);
  } catch {
    return errorResponse('Failed to bulk update transactions');
  }
}
