import { z } from 'zod';
import { hasSameRequestOrigin } from '@/lib/api/request-origin';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
const schema = z
  .strictObject({
    request_id: z.uuid(),
    observation_id: z.uuid(),
    category_id: z.uuid().nullable(),
    description: z.string().trim().min(1).max(500),
    transfer_account_id: z.uuid().nullable().optional(),
    funding_amount: z.number().positive().max(9999999999999.99).optional(),
  })
  .refine(
    (body) =>
      body.funding_amount === undefined ||
      (!!body.transfer_account_id && body.category_id === null),
  );
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { supabase, accessToken } = await getUserClient(request);
    if (!accessToken && !hasSameRequestOrigin(request))
      return errorResponse('Invalid request origin', 403);
    const { id } = await params;
    const body = schema.safeParse(await request.json().catch(() => null));
    if (!z.uuid().safeParse(id).success || !body.success)
      return errorResponse('Invalid statement transaction', 400);
    const { data, error } =
      body.data.funding_amount !== undefined
        ? await supabase.rpc('create_converted_statement_transaction', {
            p_request_id: body.data.request_id,
            p_document_id: id,
            p_observation_id: body.data.observation_id,
            p_description: body.data.description,
            p_funding_account_id: body.data.transfer_account_id,
            p_funding_amount: body.data.funding_amount,
          })
        : await supabase.rpc('create_statement_transaction', {
            p_request_id: body.data.request_id,
            p_document_id: id,
            p_observation_id: body.data.observation_id,
            p_category_id: body.data.category_id,
            p_description: body.data.description,
            p_transfer_account_id: body.data.transfer_account_id ?? null,
          });
    if (error)
      return Response.json(
        {
          error: 'Review the statement movement before creating',
          code:
            error.code === '23505'
              ? 'POSSIBLE_DUPLICATE'
              : error.message === 'Statement date is outside its period'
                ? 'STATEMENT_PERIOD_MISMATCH'
                : 'STATEMENT_REVIEW_REQUIRED',
        },
        { status: 409 },
      );
    return Response.json(data, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return errorResponse(
      error instanceof AuthError ? 'Unauthorized' : 'Could not create statement transaction',
      error instanceof AuthError ? 401 : 500,
    );
  }
}
