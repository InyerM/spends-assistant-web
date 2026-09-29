import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface DecisionBody {
  observation_id?: unknown;
  action?: unknown;
  transaction_id?: unknown;
  idempotency_key?: unknown;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as DecisionBody | null;
    if (
      !body ||
      typeof body.observation_id !== 'string' ||
      !UUID.test(body.observation_id) ||
      typeof body.idempotency_key !== 'string' ||
      !UUID.test(body.idempotency_key) ||
      (body.action !== 'accept' && body.action !== 'reject_observation') ||
      (body.action === 'accept' &&
        (typeof body.transaction_id !== 'string' || !UUID.test(body.transaction_id))) ||
      (body.action === 'reject_observation' &&
        body.transaction_id !== null &&
        body.transaction_id !== undefined)
    )
      return errorResponse('Invalid review decision', 400);

    const { data: observation, error: observationError } = await supabase
      .from('document_observations')
      .select('id')
      .eq('id', body.observation_id)
      .eq('document_id', id)
      .eq('user_id', userId)
      .single();
    const found = observation as { id: string } | null;
    if (observationError || found === null) return errorResponse('Observation not found', 404);

    const { data, error } = await supabase.rpc('decide_document_observation', {
      p_observation_id: body.observation_id,
      p_action: body.action,
      p_transaction_id: body.action === 'accept' ? body.transaction_id : null,
      p_idempotency_key: body.idempotency_key,
    });
    if (error) {
      if (error.code === 'P0002') return errorResponse(error.message, 404);
      if (['23505', '23514'].includes(error.code)) return errorResponse(error.message, 409);
      if (error.code === '22023') return errorResponse(error.message, 400);
      return errorResponse('Could not save review decision');
    }
    return Response.json({ decision_id: data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Could not save review decision');
  }
}
