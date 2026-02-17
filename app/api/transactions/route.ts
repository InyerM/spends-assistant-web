import type { NextRequest } from 'next/server';
import {
  getUserClient,
  AuthError,
  jsonResponse,
  errorResponse,
  applyTransactionBalance,
  applyAutomationRules,
} from '@/lib/api/server';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { supabase } = await getUserClient();
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

    const importId = searchParams.get('import_id');
    if (importId) query = query.eq('import_id', importId);

    const duplicateStatus = searchParams.get('duplicate_status');
    if (duplicateStatus) query = query.eq('duplicate_status', duplicateStatus);

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) return errorResponse(error.message, 400);

    return jsonResponse({ data, count });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to fetch transactions');
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();
    const { searchParams } = request.nextUrl;
    const force = searchParams.get('force') === 'true';
    const replaceId = searchParams.get('replace');
    const body = (await request.json()) as Record<string, unknown>;

    // Skip automation rules if already applied (e.g. from AI parse preview)
    const alreadyProcessed = Array.isArray(body.applied_rules) && body.applied_rules.length > 0;
    const processed = alreadyProcessed
      ? (body as Parameters<typeof applyAutomationRules>[1])
      : await applyAutomationRules(supabase, body as Parameters<typeof applyAutomationRules>[1]);

    // Duplicate detection (skip if force=true)
    if (!force && !replaceId) {
      const date = processed.date as string;
      const amount = processed.amount as number;
      const accountId = processed.account_id as string;
      const rawText = processed.raw_text as string | undefined;
      const source = processed.source as string | undefined;

      // Exact match: same raw_text + source
      let match: Record<string, unknown> | null = null;
      if (rawText && source) {
        const { data: exactMatch } = await supabase
          .from('transactions')
          .select('*')
          .eq('raw_text', rawText)
          .eq('source', source)
          .is('deleted_at', null)
          .limit(1)
          .maybeSingle();
        match = exactMatch;
      }

      // Near match: same amount + account + date
      if (!match) {
        const { data: nearMatch } = await supabase
          .from('transactions')
          .select('*')
          .eq('date', date)
          .eq('amount', amount)
          .eq('account_id', accountId)
          .is('deleted_at', null)
          .limit(1)
          .maybeSingle();
        match = nearMatch;
      }

      if (match) {
        return jsonResponse({ duplicate: true, match }, 409);
      }
    }

    // If replacing, soft-delete the original transaction first
    if (replaceId) {
      const { data: original } = await supabase
        .from('transactions')
        .select('type, amount, account_id, transfer_to_account_id')
        .eq('id', replaceId)
        .is('deleted_at', null)
        .single();

      if (original) {
        // Reverse the original transaction's balance impact
        await applyTransactionBalance(
          supabase,
          original.type as string,
          original.account_id as string,
          original.amount as number,
          original.transfer_to_account_id as string | null,
          true,
        );

        await supabase
          .from('transactions')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', replaceId);
      }
    }

    // If force=true, mark as confirmed duplicate
    if (force) {
      (processed as Record<string, unknown>).duplicate_status = 'confirmed';
    }

    // Add user_id to the insert
    (processed as Record<string, unknown>).user_id = userId;

    const { data, error } = await supabase.from('transactions').insert(processed).select().single();

    if (error) return errorResponse(error.message, 400);

    await applyTransactionBalance(
      supabase,
      data.type as string,
      data.account_id as string,
      data.amount as number,
      data.transfer_to_account_id as string | null,
    );

    // Increment monthly transaction count for usage tracking
    const month = new Date().toISOString().slice(0, 7);
    const { data: usageRow } = await supabase
      .from('usage_tracking')
      .select('id, transactions_count')
      .eq('user_id', userId)
      .eq('month', month)
      .maybeSingle();

    if (usageRow) {
      await supabase
        .from('usage_tracking')
        .update({
          transactions_count: (usageRow.transactions_count as number) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', usageRow.id);
    } else {
      await supabase.from('usage_tracking').insert({
        user_id: userId,
        month,
        ai_parses_used: 0,
        ai_parses_limit: 15,
        transactions_count: 1,
        transactions_limit: 50,
      });
    }

    return jsonResponse(data, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to create transaction');
  }
}
