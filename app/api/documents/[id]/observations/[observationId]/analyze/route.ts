import { automationMatchingErrorResponse } from '@/lib/automation/regex';
import { z } from 'zod';
import { AuthError, errorResponse, getUserClient, applyAutomationRules } from '@/lib/api/server';
import { hasSameRequestOrigin } from '@/lib/api/request-origin';
import { requestCategoryReview } from '@/lib/api/category-review-server';
import { isCardPayment } from '@/lib/category-review';
const schema = z.object({
  locale: z.enum(['es', 'en', 'pt']).default('es'),
  account_id: z.uuid().optional(),
});
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; observationId: string }> },
): Promise<Response> {
  try {
    const { supabase, userId, accessToken } = await getUserClient(request);
    if (!accessToken && !hasSameRequestOrigin(request))
      return errorResponse('Invalid request origin', 403);
    const { id, observationId } = await params;
    const body = schema.safeParse(await request.json().catch(() => ({})));
    if (
      !z.uuid().safeParse(id).success ||
      !z.uuid().safeParse(observationId).success ||
      !body.success
    )
      return errorResponse('Invalid observation', 400);
    const [doc, row] = await Promise.all([
      supabase
        .from('documents')
        .select('document_type,status')
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('document_observations')
        .select('id,amount,currency,occurred_at_text,description,source_excerpt,status')
        .eq('id', observationId)
        .eq('document_id', id)
        .eq('user_id', userId)
        .maybeSingle(),
    ]);
    if (
      doc.error ||
      row.error ||
      !doc.data ||
      doc.data.document_type !== 'statement' ||
      doc.data.status !== 'extracted' ||
      !row.data ||
      row.data.status !== 'pending'
    )
      return errorResponse('Statement movement not found', 404);
    const movement = row.data;
    if (
      movement.amount === null ||
      !Number.isFinite(Number(movement.amount)) ||
      Number(movement.amount) === 0 ||
      !movement.currency ||
      !movement.occurred_at_text
    )
      return errorResponse('Verified statement fields required', 409);
    const type = Number(movement.amount) > 0 ? 'income' : 'expense';
    const scope = await supabase
      .from('statement_currency_scopes')
      .select('account_id')
      .eq('document_id', id)
      .eq('user_id', userId)
      .eq('currency', movement.currency)
      .maybeSingle();
    const legacy = scope.data
      ? null
      : await supabase
          .from('statement_reconciliation_scopes')
          .select('account_id')
          .eq('document_id', id)
          .eq('user_id', userId)
          .maybeSingle();
    const scopedAccount = scope.data?.account_id ?? legacy?.data?.account_id;
    if (!scopedAccount || (body.data.account_id && body.data.account_id !== scopedAccount))
      return errorResponse('Review the statement account first', 409);
    const account = await supabase
      .from('accounts')
      .select('id,type')
      .eq('id', scopedAccount)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle();
    if (account.error || !account.data) return errorResponse('Account not found', 404);
    const token = accessToken ?? (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return errorResponse('Unauthorized', 401);
    const proposal = await requestCategoryReview(token, {
      amount: Math.abs(Number(movement.amount)),
      account_id: scopedAccount,
      source: 'statement',
      locale: body.data.locale,
      type,
      account_type: account.data.type,
      description: String(movement.description ?? '').slice(0, 500),
      excerpt: String(movement.source_excerpt ?? '').slice(0, 3000),
      history: [],
    });
    if (proposal instanceof Response) return proposal;
    const cardPayment =
      type === 'income' && isCardPayment(String(account.data.type), String(movement.description));
    const processed = await applyAutomationRules(supabase, {
      type,
      amount: Math.abs(Number(movement.amount)),
      date: movement.occurred_at_text,
      description: proposal.description,
      account_id: scopedAccount,
      currency: movement.currency,
      source: 'statement',
      raw_text: movement.source_excerpt,
      category_id: proposal.category_id ?? undefined,
    });
    let categoryId: string | null = null;
    if (processed.category_id && !cardPayment && proposal.kind !== 'own_transfer') {
      const category = await supabase
        .from('categories')
        .select('id,type,slug')
        .eq('id', processed.category_id)
        .eq('type', type)
        .eq('is_active', true)
        .is('deleted_at', null)
        .maybeSingle();
      if (
        !category.error &&
        category.data &&
        !['uncategorized', 'uncategorized-income'].includes(String(category.data.slug))
      )
        categoryId = String(category.data.id);
    }
    const automated = categoryId && processed.category_id !== proposal.category_id;
    return Response.json(
      {
        ...proposal,
        category_id: categoryId,
        description: processed.description,
        kind: cardPayment ? 'own_transfer' : proposal.kind,
        reason_code: cardPayment
          ? 'card_payment'
          : categoryId
            ? 'category_suggested'
            : proposal.kind === 'own_transfer'
              ? 'transfer_review'
              : 'insufficient_context',
        source: automated ? 'automation' : cardPayment ? 'evidence' : 'ai',
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    const matchingResponse = automationMatchingErrorResponse(error);
    if (matchingResponse) return matchingResponse;
    return errorResponse(
      error instanceof AuthError
        ? error.status === 403
          ? 'Invalid request origin'
          : 'Unauthorized'
        : 'Analysis unavailable',
      error instanceof AuthError ? (error.status === 403 ? 403 : 401) : 503,
    );
  }
}
