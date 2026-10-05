import type { NextRequest } from 'next/server';
import type { FinancialRole, IncomingFlowRole } from '@/types/transaction';
import {
  getUserClient,
  AuthError,
  jsonResponse,
  errorResponse,
  applyAutomationRules,
} from '@/lib/api/server';

function reviewedIncomingRole(value: unknown): IncomingFlowRole | null {
  const correction: unknown = Array.isArray(value) ? (value[0] as unknown) : value;
  if (!correction || typeof correction !== 'object') return null;
  const role = (correction as { flow_role?: unknown }).flow_role;
  if (
    role === 'receivable_principal_repayment' ||
    role === 'personal_sale_proceeds' ||
    role === 'earmarked_relief_donation'
  ) {
    return role;
  }
  return null;
}

function hasReviewedCardRefund(value: unknown): boolean {
  const correction: unknown = Array.isArray(value) ? (value[0] as unknown) : value;
  return (
    !!correction &&
    typeof correction === 'object' &&
    typeof (correction as { id?: unknown }).id === 'string'
  );
}

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
      .select(
        '*,incoming_correction:shortcut_incoming_type_corrections!shortcut_incoming_correction_transaction_fk(flow_role),card_refund_correction:shortcut_card_refund_corrections!shortcut_card_refund_transaction_fk(id)',
        { count: 'exact' },
      )
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

    const transactionRows = (data as unknown as Array<Record<string, unknown>> | null) ?? [];
    const expenseIds = transactionRows
      .filter((transaction) => transaction.type === 'expense' && typeof transaction.id === 'string')
      .map((transaction) => transaction.id as string);
    const expenseRoles = new Map<string, FinancialRole>();
    const chunks: string[][] = [];
    for (let offset = 0; offset < expenseIds.length; offset += 80) {
      chunks.push(expenseIds.slice(offset, offset + 80));
    }
    const linkedExpenses = await Promise.all(
      chunks.map(async (ids) => {
        const [receivables, relief] = await Promise.all([
          supabase
            .from('personal_receivable_events')
            .select('source_transaction_id,kind')
            .in('source_transaction_id', ids),
          supabase
            .from('relief_fund_entries')
            .select('transaction_id,kind')
            .in('transaction_id', ids),
        ]);
        if (receivables.error || relief.error) {
          throw new Error('Unable to load reviewed financial links');
        }
        return {
          receivables: (receivables.data as unknown as Array<Record<string, unknown>> | null) ?? [],
          relief: (relief.data as unknown as Array<Record<string, unknown>> | null) ?? [],
        };
      }),
    );
    for (const links of linkedExpenses) {
      for (const event of links.receivables) {
        if (event.kind === 'disbursement' && typeof event.source_transaction_id === 'string') {
          expenseRoles.set(event.source_transaction_id, 'receivable_disbursement');
        }
      }
      for (const entry of links.relief) {
        if (entry.kind !== 'outlay' || typeof entry.transaction_id !== 'string') continue;
        if (expenseRoles.has(entry.transaction_id)) {
          throw new Error('Conflicting reviewed financial links');
        }
        expenseRoles.set(entry.transaction_id, 'earmarked_relief_outlay');
      }
    }
    const transactions = transactionRows.map(
      ({ incoming_correction, card_refund_correction, ...transaction }) => {
        if (hasReviewedCardRefund(card_refund_correction) && transaction.type !== 'income') {
          throw new Error('Audited card refund has an invalid transaction direction');
        }
        return {
          ...transaction,
          financial_role:
            expenseRoles.get(transaction.id as string) ??
            (hasReviewedCardRefund(card_refund_correction)
              ? 'credit_card_refund'
              : reviewedIncomingRole(incoming_correction)),
        };
      },
    );
    return jsonResponse({ data: transactions, count });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to fetch transactions');
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { supabase } = await getUserClient(request);
    const { searchParams } = request.nextUrl;
    const force = searchParams.get('force') === 'true';
    const replaceId = searchParams.get('replace');
    const providedRequestId = request.headers.get('Idempotency-Key');
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (providedRequestId && !uuidPattern.test(providedRequestId)) {
      return errorResponse('Invalid idempotency key', 400);
    }
    if (replaceId && !uuidPattern.test(replaceId)) {
      return errorResponse('Invalid replacement ID', 400);
    }
    const requestId = providedRequestId ?? crypto.randomUUID();
    const body = (await request.json()) as Record<string, unknown>;

    const alreadyProcessed = Array.isArray(body.applied_rules) && body.applied_rules.length > 0;
    const processed = alreadyProcessed
      ? (body as Parameters<typeof applyAutomationRules>[1])
      : await applyAutomationRules(supabase, body as Parameters<typeof applyAutomationRules>[1]);
    const destination = processed.transfer_to_account_id;
    if (
      (processed.type === 'transfer' && (!destination || destination === processed.account_id)) ||
      (processed.type !== 'transfer' && destination)
    ) {
      const automationChangedFields =
        !alreadyProcessed &&
        (processed.type !== body.type ||
          processed.account_id !== body.account_id ||
          processed.transfer_to_account_id !== body.transfer_to_account_id);
      return jsonResponse(
        {
          error: automationChangedFields
            ? 'An automation rule changed the transaction type or account incompatibly'
            : 'Review the transaction type and destination account',
          code: automationChangedFields ? 'REVIEW_AUTOMATION_RULE' : 'REVIEW_TRANSACTION_FIELDS',
        },
        400,
      );
    }
    const payload = force ? { ...processed, duplicate_status: 'confirmed' } : processed;
    const { data, error } = await supabase.rpc('confirm_manual_transaction', {
      p_request_id: requestId,
      p_payload: payload,
      p_force: force,
      p_replace_id: replaceId,
    });
    if (error) {
      if (error.message === 'Transaction limit exceeded') return errorResponse(error.message, 403);
      if (error.message === 'Replacement transaction not found')
        return errorResponse(error.message, 404);
      if (
        error.message === 'Replacement transaction has a reviewed document or Shortcut decision'
      ) {
        return jsonResponse(
          {
            error:
              'This transaction is linked to a reviewed document or Shortcut item and cannot be replaced.',
            code: 'REPLACEMENT_HAS_REVIEW_LINKS',
          },
          409,
        );
      }
      if (
        error.message.startsWith('Category does not belong to caller or match transaction type') ||
        error.message.startsWith('Transfer destination must be distinct')
      ) {
        return jsonResponse(
          {
            error: 'Review the transaction type, category, and destination',
            code: 'REVIEW_TRANSACTION_FIELDS',
          },
          400,
        );
      }
      return errorResponse(error.message, 400);
    }
    if (data?.status === 'duplicate') {
      return jsonResponse({ duplicate: true, match: data.match }, 409);
    }
    if (data?.status !== 'created' || !data.transaction) {
      return errorResponse('Invalid transaction confirmation response');
    }
    return jsonResponse(data.transaction, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to create transaction');
  }
}
