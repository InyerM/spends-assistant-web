import type { NextRequest } from 'next/server';
import { getAdminClient, jsonResponse, errorResponse } from '@/lib/api/server';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const supabase = getAdminClient();
    const { searchParams } = request.nextUrl;

    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = parseInt(searchParams.get('limit') ?? '20', 10);
    const type = searchParams.get('type');
    const accountId = searchParams.get('account_id');
    const accountIds = searchParams.get('account_ids');
    const categoryId = searchParams.get('category_id');
    const source = searchParams.get('source');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const search = searchParams.get('search');

    let query = supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .order('date', { ascending: false })
      .order('time', { ascending: false });

    if (type) query = query.eq('type', type);
    if (accountIds) query = query.in('account_id', accountIds.split(','));
    else if (accountId) query = query.eq('account_id', accountId);
    if (categoryId) query = query.eq('category_id', categoryId);
    if (source) query = query.eq('source', source);
    if (dateFrom) query = query.gte('date', dateFrom);
    if (dateTo) query = query.lte('date', dateTo);
    if (search) query = query.ilike('description', `%${search}%`);

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) return errorResponse(error.message, 400);

    return jsonResponse({ data, count });
  } catch {
    return errorResponse('Failed to fetch transactions');
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const supabase = getAdminClient();
    const body = await request.json();

    const { data, error } = await supabase.from('transactions').insert(body).select().single();

    if (error) return errorResponse(error.message, 400);
    return jsonResponse(data, 201);
  } catch {
    return errorResponse('Failed to create transaction');
  }
}
