import type { NextRequest } from 'next/server';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
import { receivableConfirmSchema } from '@/lib/wealth/personal-receivables';

const privateHeaders = { 'Cache-Control': 'private, no-store' };

export async function GET(): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();
    const { data, error } = await supabase
      .from('personal_receivables')
      .select('*, personal_receivable_events(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) return errorResponse('Could not load personal receivables');
    return Response.json({ data }, { headers: privateHeaders });
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Could not load personal receivables');
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { supabase } = await getUserClient();
    const parsed = receivableConfirmSchema.safeParse(await request.json());
    if (!parsed.success)
      return errorResponse('Review and exact transaction evidence are required', 400);
    const { data, error } = await supabase.rpc('confirm_receivable_event', {
      p_request_id: parsed.data.request_id,
      p_reviewed: true,
      p_event: parsed.data.event,
    });
    if (error) {
      if (error.code === '42501') return errorResponse('Receivable not found', 404);
      if (['22023', '23514', '23505', '23503'].includes(error.code))
        return errorResponse(error.message, 400);
      return errorResponse('Could not save reviewed receivable');
    }
    const result = data as { replayed: boolean };
    return Response.json(result, { status: result.replayed ? 200 : 201, headers: privateHeaders });
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Could not save reviewed receivable');
  }
}
