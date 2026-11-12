import { z } from 'zod';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
import { hasSameRequestOrigin } from '@/lib/api/request-origin';
const amount = z
  .number()
  .positive()
  .max(9999999999999.99)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.001);
const schema = z.strictObject({ expected_amount: amount, actual_amount: amount });
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { supabase, accessToken } = await getUserClient(request);
    if (!accessToken && !hasSameRequestOrigin(request))
      return errorResponse('Invalid request origin', 403);
    const { id } = await params;
    const key = request.headers.get('Idempotency-Key');
    const body = schema.safeParse(await request.json().catch(() => null));
    if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(key).success || !body.success)
      return errorResponse('Invalid funding correction', 400);
    const { data, error } = await supabase.rpc('correct_statement_funding_amount', {
      p_request_id: key,
      p_transaction_id: id,
      p_expected_amount: body.data.expected_amount,
      p_actual_amount: body.data.actual_amount,
    });
    if (error) {
      const code =
        error.code === '23505'
          ? 'FUNDING_DUPLICATE'
          : error.message.includes('existing funding reconciliation')
            ? 'FUNDING_ALREADY_RECONCILED'
            : 'FUNDING_REVIEW_REQUIRED';
      return Response.json(
        { error: 'Review the funding debit before correcting', code },
        { status: error.code === '42501' ? 404 : 409 },
      );
    }
    return Response.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return errorResponse(
      error instanceof AuthError
        ? error.status === 403
          ? 'Invalid request origin'
          : 'Unauthorized'
        : 'Funding correction unavailable',
      error instanceof AuthError ? (error.status === 403 ? 403 : 401) : 503,
    );
  }
}
