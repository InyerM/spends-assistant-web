import type { NextRequest } from 'next/server';
import { AuthError, errorResponse, getUserClient, jsonResponse } from '@/lib/api/server';
import { investmentConfirmSchema } from '@/lib/wealth/manual-entry';

export async function GET(): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();
    const { data, error } = await supabase
      .from('investment_positions')
      .select(
        '*, investment_trades(*, investment_evidence(*)), investment_valuations(*, investment_evidence(*))',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ data });
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Failed to list investments');
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { supabase } = await getUserClient();
    const parsed = investmentConfirmSchema.safeParse(await request.json());
    if (!parsed.success) return errorResponse('Review and valid exact amounts are required', 400);
    const { request_id, event } = parsed.data;
    const { data, error } = await supabase.rpc('confirm_investment_event', {
      p_request_id: request_id,
      p_reviewed: true,
      p_event: event,
    });
    if (error) {
      if (error.code === '42501') return errorResponse('Position not found', 404);
      if (error.code === '22023' || error.code === '23514')
        return errorResponse(error.message, 400);
      return errorResponse('Failed to save investment entry');
    }
    const result = data as { replayed: boolean };
    return jsonResponse(result, result.replayed ? 200 : 201);
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Failed to save investment entry');
  }
}
