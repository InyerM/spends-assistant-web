import { z } from 'zod';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';

const linkSchema = z.strictObject({
  kind: z.enum(['investment_trade', 'loan_event']),
  event_id: z.uuid(),
  transaction_id: z.uuid().nullable(),
  reviewed: z.literal(true),
});

export async function POST(request: Request): Promise<Response> {
  const parsed = linkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse('Reviewed transaction link required', 400);
  try {
    const { supabase } = await getUserClient();
    const { data, error } = await supabase.rpc('link_manual_wealth_event', {
      p_kind: parsed.data.kind,
      p_event_id: parsed.data.event_id,
      p_transaction_id: parsed.data.transaction_id,
      p_reviewed: true,
    });
    if (error) {
      if (error.code === 'P0002') return errorResponse(error.message, 404);
      if (error.code === '23514') return errorResponse(error.message, 409);
      if (error.code === '22023') return errorResponse(error.message, 400);
      return errorResponse('Could not link transaction');
    }
    return Response.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Could not link transaction');
  }
}
