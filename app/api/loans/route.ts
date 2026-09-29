import type { NextRequest } from 'next/server';
import { AuthError, errorResponse, getUserClient, jsonResponse } from '@/lib/api/server';
import { loanConfirmSchema } from '@/lib/wealth/manual-loans';

export async function GET(): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();
    const { data, error } = await supabase
      .from('manual_loans')
      .select('*, manual_loan_events(*, manual_loan_evidence(*))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ data });
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Failed to list loans');
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { supabase } = await getUserClient();
    const parsed = loanConfirmSchema.safeParse(await request.json());
    if (!parsed.success) return errorResponse('Review and exact source amounts are required', 400);
    const { data, error } = await supabase.rpc('confirm_loan_event', {
      p_request_id: parsed.data.request_id,
      p_reviewed: true,
      p_event: parsed.data.event,
    });
    if (error) {
      if (error.code === '42501') return errorResponse('Loan not found', 404);
      if (error.code === '22023' || error.code === '23514' || error.code === '23505')
        return errorResponse(error.message, 400);
      return errorResponse('Failed to save loan entry');
    }
    const result = data as { replayed: boolean };
    return jsonResponse(result, result.replayed ? 200 : 201);
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Failed to save loan entry');
  }
}
