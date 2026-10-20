import { z } from 'zod';
import { AuthError, getUserClient, errorResponse } from '@/lib/api/server';
const schema = z.object({ used_ids: z.array(z.uuid()) });
export async function GET(): Promise<Response> {
  try {
    const { supabase } = await getUserClient();
    const { data, error } = await supabase.rpc('category_usage_summary');
    const parsed = schema.safeParse(data);
    if (error || !parsed.success) return errorResponse('Category usage unavailable', 503);
    return Response.json(parsed.data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return errorResponse(
      error instanceof AuthError ? 'Unauthorized' : 'Category usage unavailable',
      error instanceof AuthError ? 401 : 503,
    );
  }
}
