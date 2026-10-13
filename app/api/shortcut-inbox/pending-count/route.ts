import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
export async function GET(request: Request): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient(request);
    const { count, error } = await supabase
      .from('shortcut_inbox_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending');
    if (error) return errorResponse('Could not load pending reviews');
    return Response.json(
      { count: count ?? 0 },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Could not load pending reviews');
  }
}
