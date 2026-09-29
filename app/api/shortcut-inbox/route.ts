import type { NextRequest } from 'next/server';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
import { getShortcutPostClient } from '@/lib/shortcut-inbox/auth';
import { ingestBatch, type InboxRow, type InboxStore } from '@/lib/shortcut-inbox/intake';
import type { SupabaseClient } from '@supabase/supabase-js';

const MAX_BODY_BYTES = 128 * 1024;
const privateHeaders = { 'Cache-Control': 'private, no-store' };

function inboxStore(supabase: SupabaseClient): InboxStore {
  return {
    async create(row): Promise<{ row: InboxRow } | { duplicate: true }> {
      const { data, error } = await supabase
        .from('shortcut_inbox_items')
        .insert(row)
        .select('id,user_id,source,external_id,received_at,raw_text,idempotency_key,status')
        .single();
      if (error?.code === '23505') return { duplicate: true };
      if (error) throw new Error('Inbox write failed');
      return { row: data as InboxRow };
    },
    async findByKey(userId, key): Promise<InboxRow | null> {
      const { data, error } = await supabase
        .from('shortcut_inbox_items')
        .select('id,user_id,source,external_id,received_at,raw_text,idempotency_key,status')
        .eq('user_id', userId)
        .eq('idempotency_key', key)
        .maybeSingle();
      if (error) throw new Error('Inbox lookup failed');
      return data as InboxRow | null;
    },
  };
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { supabase, userId } = await getShortcutPostClient(request);
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
      return errorResponse('Batch too large', 413);
    }
    let input: unknown;
    try {
      input = JSON.parse(body);
    } catch {
      return errorResponse('Invalid JSON', 400);
    }
    try {
      const result = await ingestBatch(input, userId, inboxStore(supabase));
      const statuses = result.items.map((item) => item.status);
      const status = statuses.every((value) => value === 'received')
        ? 201
        : statuses.every((value) => value === 'previously_received')
          ? 200
          : 207;
      return Response.json(result, { status, headers: privateHeaders });
    } catch (error) {
      if (error instanceof Error && error.message === 'Invalid batch') {
        return errorResponse('Invalid batch', 400);
      }
      throw error;
    }
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Inbox intake failed');
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();
    const params = new URL(request.url).searchParams;
    const requestedPage = Number(params.get('page') ?? '1');
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const requestedLimit = Number(params.get('limit') ?? '20');
    const limit =
      Number.isSafeInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 100)
        : 20;
    const from = (page - 1) * limit;
    let query = supabase
      .from('shortcut_inbox_items')
      .select('id,source,external_id,received_at,raw_text,status,created_at', { count: 'exact' })
      .eq('user_id', userId);
    const status = params.get('status');
    if (status && ['pending', 'non_transaction', 'dismissed'].includes(status)) {
      query = query.eq('status', status);
    }
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);
    if (error) return errorResponse('Inbox list failed');
    return Response.json({ data, count, page, limit }, { headers: privateHeaders });
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Inbox list failed');
  }
}
