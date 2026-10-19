import { z } from 'zod';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';

const command = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('scope'),
      account_id: z.uuid(),
      currency: z.enum(['COP', 'USD']).optional(),
      period_start: z.iso.date(),
      period_end: z.iso.date(),
    })
    .extend({ request_id: z.uuid().optional() })
    .strict(),
  z
    .object({ action: z.literal('confirm'), observation_id: z.uuid(), transaction_id: z.uuid() })
    .extend({ request_id: z.uuid().optional() })
    .strict(),
  z
    .object({ action: z.literal('undo'), link_id: z.uuid() })
    .extend({ request_id: z.uuid().optional() })
    .strict(),
]);
interface Context {
  params: Promise<{ id: string }>;
}
export async function GET(request: Request, { params }: Context): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient(request);
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return errorResponse('Invalid statement ID', 400);
    const doc = await supabase
      .from('documents')
      .select('id,document_type,status,statement_metadata')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (doc.error) throw new Error('Could not load statement');
    if (!doc.data || doc.data.document_type !== 'statement' || doc.data.status !== 'extracted')
      return errorResponse('Statement not found', 404);
    const [scope, rows, proofs, currencyScopes] = await Promise.all([
      supabase
        .from('statement_reconciliation_scopes')
        .select('account_id,period_start,period_end')
        .eq('document_id', id)
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('document_observations')
        .select('id,amount,currency,occurred_at_text,status,description')
        .eq('document_id', id)
        .eq('user_id', userId)
        .order('ordinal')
        .limit(1000),
      supabase
        .from('statement_reconciliation_proofs')
        .select('*')
        .eq('document_id', id)
        .eq('user_id', userId)
        .limit(1000),
      supabase
        .from('statement_currency_scopes')
        .select('account_id,period_start,period_end,currency')
        .eq('document_id', id)
        .eq('user_id', userId),
    ]);
    if (scope.error || rows.error || proofs.error || currencyScopes.error)
      throw new Error('Could not load reconciliation');
    if (rows.data.length >= 1000 || proofs.data.length >= 1000)
      return errorResponse('Statement exceeds review limit', 422);
    const transactions: Record<string, unknown>[] = [];
    const allScopes = [...(scope.data ? [scope.data] : []), ...currencyScopes.data];
    const uniqueScopes = [
      ...new Map(
        allScopes.map((entry) => [
          `${entry.account_id}:${entry.period_start}:${entry.period_end}`,
          entry,
        ]),
      ).values(),
    ];
    for (const selectedScope of uniqueScopes) {
      for (let offset = 0; offset < 20000; offset += 1000) {
        const result = await supabase
          .from('transactions')
          .select('id,account_id,transfer_to_account_id,amount,currency,date,type,description')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .gte('date', selectedScope.period_start)
          .lte('date', selectedScope.period_end)
          .or(
            `account_id.eq.${selectedScope.account_id},transfer_to_account_id.eq.${selectedScope.account_id}`,
          )
          .order('id')
          .range(offset, offset + 999);
        if (result.error) throw new Error('Could not load statement transactions');
        transactions.push(...result.data);
        if (result.data.length < 1000) break;
        if (offset === 19000) return errorResponse('Statement period exceeds review limit', 422);
      }
    }
    return Response.json(
      {
        scope: scope.data,
        scopes: currencyScopes.data,
        metadata: doc.data.statement_metadata,
        rows: rows.data,
        proofs: proofs.data,
        transactions: [...new Map(transactions.map((t) => [t.id, t])).values()],
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Could not load reconciliation');
  }
}
export async function POST(request: Request, { params }: Context): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient(request);
    const { id } = await params;
    const body = command.safeParse(await request.json());
    if (!z.uuid().safeParse(id).success || !body.success)
      return errorResponse('Invalid reconciliation request', 400);
    const data = body.data;
    if (data.action === 'scope' && data.currency) {
      const result = await supabase.rpc('set_statement_currency_scope', {
        p_document_id: id,
        p_account_id: data.account_id,
        p_period_start: data.period_start,
        p_period_end: data.period_end,
        p_currency: data.currency,
      });
      return result.error
        ? errorResponse('Account currency or statement period does not match', 409)
        : Response.json({ success: true });
    }
    if (data.request_id) {
      const { request_id, ...payload } = data;
      const result = await supabase.rpc('apply_statement_reconciliation_command', {
        p_request_id: request_id,
        p_document_id: id,
        p_payload: payload,
      });
      return result.error
        ? errorResponse('Reconciliation could not be saved. Refresh and review the movement.', 409)
        : Response.json({ success: true });
    }
    if (data.action === 'undo') {
      const owned = await supabase
        .from('statement_reconciliation_links')
        .select('id')
        .eq('id', data.link_id)
        .eq('document_id', id)
        .eq('user_id', userId)
        .maybeSingle();
      if (owned.error || !owned.data) return errorResponse('Reconciliation not found', 404);
    }
    const result =
      data.action === 'scope'
        ? await supabase.rpc('set_statement_reconciliation_scope', {
            p_document_id: id,
            p_account_id: data.account_id,
            p_period_start: data.period_start,
            p_period_end: data.period_end,
          })
        : data.action === 'confirm'
          ? await supabase.rpc('confirm_statement_reconciliation', {
              p_document_id: id,
              p_observation_id: data.observation_id,
              p_transaction_id: data.transaction_id,
            })
          : await supabase.rpc('undo_statement_reconciliation', { p_link_id: data.link_id });
    if (result.error)
      return errorResponse(
        'Reconciliation could not be saved. Refresh and review the account, period and movement.',
        409,
      );
    return Response.json({ success: true });
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Could not save reconciliation');
  }
}
