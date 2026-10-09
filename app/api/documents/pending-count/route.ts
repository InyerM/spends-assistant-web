import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';

export async function GET(request: Request): Promise<Response> {
  try {
    const { supabase } = await getUserClient(request);
    const { data, error } = await supabase.rpc('pending_document_count');
    if (error) return errorResponse('Could not load pending documents');
    return Response.json(
      { count: Number(data) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Could not load pending documents');
  }
}
