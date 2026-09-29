import type { NextRequest } from 'next/server';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';

interface Context {
  params: Promise<{ id: string }>;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export async function POST(request: NextRequest, context: Context): Promise<Response> {
  try {
    const { supabase } = await getUserClient();
    const { id } = await context.params;
    if (!uuid.test(id)) return errorResponse('Invalid inbox item ID', 400);
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > 1024)
      return errorResponse('Request too large', 413);
    let input: unknown;
    try {
      input = JSON.parse(body);
    } catch {
      return errorResponse('Invalid JSON', 400);
    }
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return errorResponse('Invalid match decision', 400);
    }
    const fields = Object.keys(input);
    const transactionId = (input as Record<string, unknown>).transaction_id;
    if (fields.length !== 1 || typeof transactionId !== 'string' || !uuid.test(transactionId)) {
      return errorResponse('Invalid match decision', 400);
    }

    const { data, error } = await supabase.rpc('acknowledge_shortcut_match', {
      p_inbox_item_id: id,
      p_transaction_id: transactionId,
    });
    if (error?.code === 'P0002') return errorResponse('Inbox item or transaction not found', 404);
    if (error?.code === '23505' || error?.code === '23514') {
      return errorResponse('Match decision conflicts with current review state', 409);
    }
    if (error) return errorResponse('Match acknowledgement failed');
    return Response.json(
      { decision_id: data },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Match acknowledgement failed');
  }
}
