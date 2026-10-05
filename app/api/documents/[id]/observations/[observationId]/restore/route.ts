import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; observationId: string }> },
): Promise<Response> {
  try {
    const { id, observationId } = await params;
    if (!UUID.test(id) || !UUID.test(observationId))
      return errorResponse('Invalid observation', 400);
    const { supabase, userId } = await getUserClient(request);
    const { error: findError } = await supabase
      .from('document_observations')
      .select('id')
      .eq('id', observationId)
      .eq('document_id', id)
      .eq('user_id', userId)
      .single();
    if (findError) return errorResponse('Observation not found', 404);
    const { data, error } = await supabase.rpc('restore_document_observation', {
      p_observation_id: observationId,
    });
    if (error) {
      if (error.code === 'P0002') return errorResponse('Observation not found', 404);
      if (error.code === '23514') return errorResponse(error.message, 409);
      return errorResponse('Could not restore observation');
    }
    return Response.json(
      { restoration_id: data },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Could not restore observation');
  }
}
