import { z } from 'zod';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
const schema = z.object({
  scope: z.enum(['uncategorized', 'all']).default('uncategorized'),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  search: z.string().trim().max(100).default(''),
});
export async function GET(request: Request): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient(request);
    const parsed = schema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return errorResponse('Invalid review filters', 400);
    const { scope, page, search } = parsed.data;
    let query = supabase
      .from('transactions')
      .select('id,description,notes,category_id,account_id,type,date,amount,currency', {
        count: 'exact',
      })
      .eq('user_id', userId)
      .eq('type', 'expense')
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .order('id', { ascending: false });
    if (scope === 'uncategorized') {
      const categories = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', userId)
        .in('slug', ['uncategorized', 'uncategorized-income', 'missing']);
      if (categories.error) return errorResponse('Review queue unavailable', 503);
      const ids = categories.data.map((row) => row.id as string);
      query = ids.length
        ? query.or(`category_id.is.null,category_id.in.(${ids.join(',')})`)
        : query.is('category_id', null);
    }
    if (search) query = query.ilike('description', `%${search.replace(/[\\%_]/g, '\\$&')}%`);
    const { data, error, count } = await query.range((page - 1) * 10, page * 10 - 1);
    if (error) return errorResponse('Review queue unavailable', 503);
    return Response.json(
      { data, count: count ?? 0, page },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(
      error instanceof AuthError ? 'Unauthorized' : 'Review queue unavailable',
      error instanceof AuthError ? 401 : 503,
    );
  }
}
