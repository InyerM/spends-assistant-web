import type { NextRequest } from 'next/server';
import {
  getAdminClient,
  jsonResponse,
  errorResponse,
  applyTransactionBalance,
  applyAutomationRules,
} from '@/lib/api/server';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const supabase = getAdminClient();
    const { searchParams } = request.nextUrl;

    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = parseInt(searchParams.get('limit') ?? '20', 10);
    const type = searchParams.get('type');
    const types = searchParams.get('types');
    const accountId = searchParams.get('account_id');
    const accountIds = searchParams.get('account_ids');
    const categoryId = searchParams.get('category_id');
    const categoryIds = searchParams.get('category_ids');
    const source = searchParams.get('source');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sort_by') ?? 'date';
    const sortOrder = searchParams.get('sort_order') ?? 'desc';

    const ascending = sortOrder === 'asc';

    let query = supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .is('deleted_at', null);

    if (sortBy === 'amount') {
      query = query.order('amount', { ascending }).order('date', { ascending: false });
    } else {
      query = query.order('date', { ascending }).order('time', { ascending });
    }

    if (types) query = query.in('type', types.split(','));
    else if (type) query = query.eq('type', type);
    if (accountIds) query = query.in('account_id', accountIds.split(','));
    else if (accountId) query = query.eq('account_id', accountId);
    if (categoryIds) query = query.in('category_id', categoryIds.split(','));
    else if (categoryId) query = query.eq('category_id', categoryId);
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
    const body = (await request.json()) as Record<string, unknown>;

    const processed = await applyAutomationRules(
      supabase,
      body as Parameters<typeof applyAutomationRules>[1],
    );

    const { data, error } = await supabase.from('transactions').insert(processed).select().single();

    if (error) return errorResponse(error.message, 400);

    await applyTransactionBalance(
      supabase,
      data.type as string,
      data.account_id as string,
      data.amount as number,
      data.transfer_to_account_id as string | null,
    );

    return jsonResponse(data, 201);
  } catch {
    return errorResponse('Failed to create transaction');
  }
}
