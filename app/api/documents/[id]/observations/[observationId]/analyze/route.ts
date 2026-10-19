import { z } from 'zod';
import { AuthError, errorResponse, getUserClient, applyAutomationRules } from '@/lib/api/server';
import { hasSameRequestOrigin } from '@/lib/api/request-origin';
import { workerConfig } from '@/lib/config';
import { forwardAiConsentError } from '@/lib/ai-consent';
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; observationId: string }> },
): Promise<Response> {
  try {
    const { supabase, userId, accessToken } = await getUserClient(request);
    if (!accessToken && !hasSameRequestOrigin(request))
      return errorResponse('Invalid request origin', 403);
    const { id, observationId } = await params;
    if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(observationId).success)
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
    const token = accessToken ?? (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return errorResponse('Unauthorized', 401);
    const response = await fetch(`${workerConfig.url}/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        text: `Statement ${type}. Currency: ${movement.currency}. Date: ${movement.occurred_at_text}. Amount: ${Math.abs(Number(movement.amount))}. ${movement.description}\n${movement.source_excerpt}`,
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok)
      return (await forwardAiConsentError(response)) ?? errorResponse('Analysis unavailable', 503);
    const result = (await response.json()) as {
      parsed?: { description?: string };
      resolved?: { category_id?: string };
    };
    const description =
      typeof result.parsed?.description === 'string'
        ? result.parsed.description.slice(0, 500)
        : movement.description;
    const processed = await applyAutomationRules(supabase, {
      type,
      amount: Math.abs(Number(movement.amount)),
      date: movement.occurred_at_text,
      description,
      account_id: '',
      source: 'statement',
      raw_text: movement.source_excerpt,
      category_id: result.resolved?.category_id,
    });
    let categoryId: string | null = null;
    if (processed.category_id) {
      const category = await supabase
        .from('categories')
        .select('id,type')
        .eq('id', processed.category_id)
        .eq('type', type)
        .eq('is_active', true)
        .is('deleted_at', null)
        .maybeSingle();
      if (!category.error && category.data) categoryId = category.data.id;
    }
    return Response.json(
      {
        category_id: categoryId,
        description: processed.description,
        source:
          Array.isArray(processed.applied_rules) && processed.applied_rules.length
            ? 'automation'
            : 'ai',
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(
      error instanceof AuthError ? 'Unauthorized' : 'Analysis unavailable',
      error instanceof AuthError ? 401 : 503,
    );
  }
}
