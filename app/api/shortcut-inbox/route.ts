import { z } from 'zod';
import { EMAIL_MESSAGE_KINDS } from '@/types/shortcut-inbox';
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
    const { supabase, userId } = await getUserClient(request);
    const params = new URL(request.url).searchParams;
    const source = params.get('source');
    const kind = params.get('kind');
    if (kind && !(EMAIL_MESSAGE_KINDS as readonly string[]).includes(kind))
      return errorResponse('Invalid email message kind', 400);
    const sort = params.get('sort') ?? 'newest';
    if (!['newest', 'oldest'].includes(sort)) return errorResponse('Invalid inbox sort', 400);
    const itemId = params.get('item_id');
    if (itemId && !z.uuid().safeParse(itemId).success)
      return errorResponse('Invalid inbox item ID', 400);
    const dateFrom = params.get('date_from');
    const dateTo = params.get('date_to');
    if (
      (dateFrom !== null && !z.iso.date().safeParse(dateFrom).success) ||
      (dateTo !== null && !z.iso.date().safeParse(dateTo).success) ||
      (dateFrom && dateTo && dateFrom > dateTo)
    ) {
      return errorResponse('Invalid received date range', 400);
    }

    const search = (params.get('q') ?? '').trim();
    if (search.length > 200) return errorResponse('Search text too long', 400);
    if (source === 'forwarded_email') {
      const { data: route, error: routeError } = await supabase
        .from('email_forwarding_routes')
        .select('confirmation_received_at,user_confirmed_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (routeError) return errorResponse('Email forwarding status unavailable');
      if (!route?.confirmation_received_at || !route.user_confirmed_at) {
        return errorResponse('Email forwarding is not verified', 403);
      }
    }
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
      .select(
        'id,source,external_id,received_at,raw_text,status,message_kind,created_at,attachments:documents!documents_email_source_owner_fk(id,file_name,status)',
        { count: 'exact' },
      )
      .eq('user_id', userId);
    const status = params.get('status');
    if (itemId) query = query.eq('id', itemId);
    if (source === 'forwarded_email') query = query.eq('source', source);
    else query = query.neq('source', 'forwarded_email');
    if (
      !itemId &&
      status &&
      ['pending', 'non_transaction', 'dismissed', 'matched', 'created'].includes(status)
    ) {
      query = query.eq('status', status);
    }
    if (kind) query = query.eq('message_kind', kind);
    if (dateFrom) query = query.gte('received_at', `${dateFrom}T00:00:00-05:00`);
    if (dateTo) {
      const nextDay = new Date(`${dateTo}T00:00:00Z`);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      query = query.lt('received_at', `${nextDay.toISOString().slice(0, 10)}T00:00:00-05:00`);
    }
    if (search) query = query.ilike('raw_text', `%${search.replace(/[\\%_]/gu, '\\$&')}%`);
    const { data, count, error } = await query
      .order('received_at', { ascending: sort === 'oldest' })
      .order('id', { ascending: sort === 'oldest' })
      .range(from, from + limit - 1);
    if (error) return errorResponse('Inbox list failed');
    const inboxRows = data as Array<Record<string, unknown> & { id: string; status: string }>;
    const matchedIds = inboxRows
      .filter((item) => ['matched', 'created'].includes(item.status))
      .map((item) => item.id);
    if (matchedIds.length === 0) {
      return Response.json({ data, count, page, limit }, { headers: privateHeaders });
    }
    const { data: decisions, error: decisionError } = await supabase
      .from('shortcut_inbox_match_decisions')
      .select('id,inbox_item_id,transaction_id,shortcut_inbox_match_reversals(id)')
      .eq('user_id', userId)
      .in('inbox_item_id', matchedIds);
    if (decisionError) {
      return errorResponse('Inbox list failed');
    }
    const decisionRows = decisions as Array<{
      id: string;
      inbox_item_id: string;
      transaction_id: string;
      shortcut_inbox_match_reversals?: Array<{ id: string }>;
    }>;
    const activeDecisions = decisionRows.filter(
      (decision) => !decision.shortcut_inbox_match_reversals?.length,
    );
    if (
      activeDecisions.length !== matchedIds.length ||
      new Set(activeDecisions.map((decision) => decision.inbox_item_id)).size !== matchedIds.length
    ) {
      return errorResponse('Inbox list failed');
    }
    const matchByItem = new Map<string, { decision_id: string; transaction_id: string }>(
      activeDecisions.map((decision) => [
        decision.inbox_item_id,
        {
          decision_id: decision.id,
          transaction_id: decision.transaction_id,
        },
      ]),
    );
    return Response.json(
      {
        data: inboxRows.map((item) =>
          ['matched', 'created'].includes(item.status)
            ? { ...item, match: matchByItem.get(item.id) }
            : item,
        ),
        count,
        page,
        limit,
      },
      { headers: privateHeaders },
    );
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Inbox list failed');
  }
}
