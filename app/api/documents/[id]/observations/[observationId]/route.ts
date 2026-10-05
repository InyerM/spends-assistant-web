import { z } from 'zod';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';

const reviewSchema = z.strictObject({
  amount: z.number().refine((value) => value !== 0 && Math.abs(value) <= 9_999_999_999_999.99),
  currency: z
    .string()
    .regex(/^[A-Z]{3,5}$/)
    .nullable(),
  occurred_at_text: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d)?$/)
    .nullable(),
  description: z.string().trim().min(1).max(300),
});

interface RouteContext {
  params: Promise<{ id: string; observationId: string }>;
}

export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const { id, observationId } = await params;
    if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(observationId).success)
      return errorResponse('Invalid document or observation ID', 400);
    const { supabase, userId } = await getUserClient(request);
    const { data: observation, error: observationError } = await supabase
      .from('document_observations')
      .select('id')
      .eq('id', observationId)
      .eq('document_id', id)
      .eq('user_id', userId)
      .single();
    const found = observation as { id: string } | null;
    if (observationError || found === null) return errorResponse('Observation not found', 404);

    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('source', 'web-document')
      .contains('parsed_data', { document_id: id, observation_id: observationId })
      .is('deleted_at', null)
      .limit(2);
    if (error) return errorResponse('Could not check created transactions');
    const matches = (transactions as Array<{ id: string }> | null) ?? [];
    if (matches.length > 1)
      return errorResponse('Multiple created transactions require manual review', 409);
    return Response.json(
      { transaction_id: matches.length > 0 ? matches[0].id : null },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Could not check created transactions');
  }
}

export async function PATCH(request: Request, { params }: RouteContext): Promise<Response> {
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse('Invalid observation correction', 400);
  try {
    const { id, observationId } = await params;
    if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(observationId).success)
      return errorResponse('Invalid document or observation ID', 400);
    const { supabase, userId } = await getUserClient(request);
    const { data: observation, error: lookupError } = await supabase
      .from('document_observations')
      .select('id')
      .eq('id', observationId)
      .eq('document_id', id)
      .eq('user_id', userId)
      .single();
    const found = observation as { id: string } | null;
    if (lookupError || found === null) return errorResponse('Observation not found', 404);

    const { data, error } = await supabase.rpc('revise_document_observation', {
      p_observation_id: observationId,
      p_amount: parsed.data.amount,
      p_currency: parsed.data.currency,
      p_occurred_at_text: parsed.data.occurred_at_text,
      p_description: parsed.data.description,
    });
    if (error) {
      if (error.code === 'P0002') return errorResponse('Observation not found', 404);
      if (error.code === '23514') return errorResponse(error.message, 409);
      if (error.code === '22023') return errorResponse(error.message, 400);
      return errorResponse('Could not save observation correction');
    }
    return Response.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Could not save observation correction');
  }
}
