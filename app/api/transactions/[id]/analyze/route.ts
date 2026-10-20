import { z } from 'zod';
import { getUserClient, AuthError, errorResponse } from '@/lib/api/server';
import { hasSameRequestOrigin } from '@/lib/api/request-origin';
import { requestCategoryReview } from '@/lib/api/category-review-server';
import type { Transaction } from '@/types';
import type { CategoryFollowup } from '@/lib/api/queries/category-followup.queries';
const schema = z.strictObject({
  locale: z.enum(['en', 'es', 'pt']),
  description: z.string().max(500).optional(),
  notes: z.string().max(1500).optional(),
  type: z.enum(['expense', 'income', 'transfer']).optional(),
  account_id: z.uuid().optional(),
});
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { supabase, userId, accessToken } = await getUserClient(request);
    if (!accessToken && !hasSameRequestOrigin(request))
      return errorResponse('Invalid request origin', 403);
    const { id } = await params;
    const body = schema.safeParse(await request.json().catch(() => null));
    if (!z.uuid().safeParse(id).success || !body.success)
      return errorResponse('Invalid analysis', 400);
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();
    if (error || !data) return errorResponse('Transaction not found', 404);
    const transaction = data as Transaction;
    const [account, context] = await Promise.all([
      supabase
        .from('accounts')
        .select('type')
        .eq('id', body.data.account_id ?? transaction.account_id)
        .eq('user_id', userId)
        .single(),
      supabase.rpc('counterparty_category_followup', { p_transaction: id }),
    ]);
    if (!account.data) return errorResponse('Account not found', 404);
    const history = context.data as CategoryFollowup | null;
    const token = accessToken ?? (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return errorResponse('Unauthorized', 401);
    const result = await requestCategoryReview(token, {
      transaction_id: transaction.id,
      amount: transaction.amount,
      account_id: body.data.account_id ?? transaction.account_id,
      source: transaction.source,
      locale: body.data.locale,
      type: body.data.type ?? transaction.type,
      account_type: account.data.type,
      description: (body.data.description ?? transaction.description).slice(0, 500),
      notes: (body.data.notes ?? transaction.notes ?? '').slice(0, 1500),
      excerpt: transaction.raw_text?.slice(0, 3000),
      ...(transaction.category_id ? { category_id: transaction.category_id } : {}),
      history: (history?.evidence ?? []).map((row) => ({
        id: row.id,
        description: row.description.slice(0, 500),
        notes: row.notes?.slice(0, 1500),
        category: row.category_name,
      })),
    });
    return result instanceof Response
      ? result
      : Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return errorResponse(
      error instanceof AuthError ? 'Unauthorized' : 'Analysis unavailable',
      error instanceof AuthError ? 401 : 503,
    );
  }
}
