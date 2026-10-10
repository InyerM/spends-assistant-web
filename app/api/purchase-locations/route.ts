import { AuthError, getUserClient, errorResponse } from '@/lib/api/server';
export async function GET(request: Request): Promise<Response> {
  try {
    const { supabase } = await getUserClient(request);
    const params = new URL(request.url).searchParams;
    const offset = Number(params.get('offset') ?? 0);
    if (!Number.isInteger(offset) || offset < 0 || offset > 100000)
      return errorResponse('Invalid location page', 400);
    const result = await supabase.rpc('get_purchase_locations', { p_limit: 100, p_offset: offset });
    if (result.error) return errorResponse('Locations unavailable', 400);
    return Response.json(result.data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return errorResponse('Locations unavailable', error instanceof AuthError ? 401 : 500);
  }
}
