import { z } from 'zod';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient(request);
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return errorResponse('Invalid transaction ID', 400);
    const transaction = await supabase
      .from('transactions')
      .select('id,parsed_data')
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle();
    if (transaction.error) return errorResponse('Could not load transaction evidence');
    if (!transaction.data) return errorResponse('Transaction not found', 404);
    const [observation, decision] = await Promise.all([
      supabase
        .from('document_observations')
        .select('document_id')
        .eq('match_transaction_id', id)
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('shortcut_inbox_match_decisions')
        .select('inbox_item_id,shortcut_inbox_match_reversals(decision_id)')
        .eq('transaction_id', id)
        .eq('user_id', userId)
        .is('shortcut_inbox_match_reversals', null)
        .limit(1)
        .maybeSingle(),
    ]);
    if (observation.error || decision.error)
      return errorResponse('Could not load transaction evidence');
    const parsed = transaction.data.parsed_data as Record<string, unknown> | null;
    const documentId = observation.data?.document_id ?? parsed?.document_id;
    let document = null;
    if (z.uuid().safeParse(documentId).success) {
      const result = await supabase
        .from('documents')
        .select('id,file_name,source_inbox_item_id')
        .eq('id', documentId as string)
        .eq('user_id', userId)
        .maybeSingle();
      if (result.error) return errorResponse('Could not load original document');
      document = result.data;
    }
    const activeMatch = decision.data && decision.data.shortcut_inbox_match_reversals.length === 0;
    const inboxId =
      document?.source_inbox_item_id ?? (activeMatch ? decision.data?.inbox_item_id : null);
    let inbox = null;
    if (inboxId) {
      const result = await supabase
        .from('shortcut_inbox_items')
        .select('id,source,raw_text,received_at')
        .eq('id', inboxId)
        .eq('user_id', userId)
        .maybeSingle();
      if (result.error) return errorResponse('Could not load original message');
      inbox = result.data;
    }
    return Response.json(
      { document, inbox },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Could not load transaction evidence');
  }
}
