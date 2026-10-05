import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as { archived?: unknown } | null;
    if (!UUID.test(id) || typeof body?.archived !== 'boolean')
      return errorResponse('Invalid archive request', 400);
    const { supabase } = await getUserClient(request);
    const { data, error } = await supabase.rpc('set_document_archived', {
      p_document_id: id,
      p_archived: body.archived,
    });
    if (error) {
      if (error.code === 'P0002') return errorResponse('Document not found', 404);
      if (error.code === '23514') return errorResponse(error.message, 409);
      return errorResponse('Could not update document archive');
    }
    return Response.json({ archived: data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Could not update document archive');
  }
}
