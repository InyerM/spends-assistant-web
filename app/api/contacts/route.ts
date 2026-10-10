import { z } from 'zod';
import { AuthError, getUserClient, errorResponse } from '@/lib/api/server';
const privateHeaders = { 'Cache-Control': 'private, no-store' };

export async function GET(request: Request): Promise<Response> {
  try {
    const { supabase } = await getUserClient(request);
    const params = new URL(request.url).searchParams;
    const query = params.get('q')?.trim() ?? '';
    const page = Number(params.get('page') ?? 1);
    const sort = z
      .enum(['recent', 'most_transactions', 'fewest_transactions'])
      .safeParse(params.get('sort') ?? 'recent');
    if (
      !sort.success ||
      query.length > 200 ||
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 10000
    )
      return errorResponse('Invalid contact filters', 400);
    const { data, error } = await supabase.rpc(
      sort.data === 'recent' ? 'list_counterparties' : 'list_counterparties_sorted',
      {
        p_query: query,
        p_offset: (page - 1) * 50,
        p_limit: 50,
        ...(sort.data === 'recent' ? {} : { p_sort: sort.data }),
      },
    );
    if (error) return errorResponse('Contacts unavailable');
    return Response.json(data, { headers: privateHeaders });
  } catch (error) {
    return errorResponse(
      error instanceof AuthError ? 'Unauthorized' : 'Contacts unavailable',
      error instanceof AuthError ? 401 : 500,
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { supabase, accessToken } = await getUserClient(request);
    if (!accessToken && request.headers.get('Origin') !== new URL(request.url).origin)
      return errorResponse('Invalid request origin', 403);
    const text = await request.text();
    if (text.length > 1024) return errorResponse('Request too large', 413);
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      return errorResponse('Invalid scan request', 400);
    }
    const parsed = z.object({ after: z.uuid().nullable().optional() }).strict().safeParse(value);
    if (!parsed.success) return errorResponse('Invalid scan request', 400);
    const { data, error } = await supabase.rpc('scan_counterparty_catalog', {
      p_after: parsed.data.after ?? null,
      p_limit: 200,
    });
    if (error) return errorResponse('Contact scan failed');
    return Response.json(data, { headers: privateHeaders });
  } catch (error) {
    return errorResponse(
      error instanceof AuthError ? 'Unauthorized' : 'Contact scan failed',
      error instanceof AuthError ? 401 : 500,
    );
  }
}
