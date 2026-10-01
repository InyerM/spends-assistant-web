import type { NextRequest } from 'next/server';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';

interface Context {
  params: Promise<{ id: string }>;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const amount = /^(0|[1-9][0-9]{0,12})(?:\.[0-9]{1,2})?$/u;
const hash = /^[a-f0-9]{32}$/u;
const privateHeaders = { 'Cache-Control': 'private, no-store' };
const requiredFields = ['account_id', 'category_id', 'type', 'amount', 'date', 'description'];
const allowedFields = new Set([
  ...requiredFields,
  'reviewed_candidate_hash',
  'confirm_distinct',
  'event_at',
  'event_time_confirmed',
]);

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validEventAt(value: string, date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/u.test(value)) {
    return false;
  }
  const instant = new Date(value);
  if (Number.isNaN(instant.valueOf())) return false;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const part = (kind: string): string => parts.find(({ type }) => type === kind)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}` === date;
}

export async function POST(request: NextRequest, context: Context): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();
    const { id } = await context.params;
    if (!uuid.test(id)) return errorResponse('Invalid inbox item ID', 400);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 4096) {
      return errorResponse('Request too large', 413);
    }
    let input: unknown;
    try {
      input = JSON.parse(raw);
    } catch {
      return errorResponse('Invalid JSON', 400);
    }
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return errorResponse('Invalid reviewed transaction', 400);
    }
    const body = input as Record<string, unknown>;
    if (
      Object.keys(body).some((field) => !allowedFields.has(field)) ||
      requiredFields.some((field) => !(field in body)) ||
      typeof body.account_id !== 'string' ||
      !uuid.test(body.account_id) ||
      typeof body.category_id !== 'string' ||
      !uuid.test(body.category_id) ||
      (body.type !== 'expense' && body.type !== 'income') ||
      typeof body.amount !== 'string' ||
      !amount.test(body.amount) ||
      Number(body.amount) <= 0 ||
      typeof body.date !== 'string' ||
      !validDate(body.date) ||
      typeof body.description !== 'string' ||
      body.description.trim().length < 1 ||
      body.description.trim().length > 500 ||
      (body.reviewed_candidate_hash !== undefined &&
        (typeof body.reviewed_candidate_hash !== 'string' ||
          !hash.test(body.reviewed_candidate_hash))) ||
      (body.confirm_distinct !== undefined && typeof body.confirm_distinct !== 'boolean') ||
      (body.confirm_distinct === true && !body.reviewed_candidate_hash) ||
      (body.event_at === undefined) !== (body.event_time_confirmed === undefined) ||
      (body.event_at !== undefined &&
        (typeof body.event_at !== 'string' ||
          !validEventAt(body.event_at, body.date as string) ||
          body.event_time_confirmed !== true))
    ) {
      return errorResponse('Invalid reviewed transaction', 400);
    }

    const reviewedPayload = {
      account_id: body.account_id,
      category_id: body.category_id,
      type: body.type,
      amount: body.amount,
      date: body.date,
      description: body.description.trim(),
      ...(body.event_at !== undefined
        ? { event_at: body.event_at, event_time_confirmed: true }
        : {}),
    };
    const { data: inbox, error: inboxError } = await supabase
      .from('shortcut_inbox_items')
      .select('source')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (inboxError) return errorResponse('Inbox lookup failed');
    if (!inbox) return errorResponse('Inbox item not found', 404);
    if ((inbox as { source: string }).source === 'lulo-email-backfill') {
      return errorResponse('Lulo email review is read-only', 409);
    }
    const { data, error } = await supabase.rpc('confirm_shortcut_transaction', {
      p_inbox_item_id: id,
      p_reviewed_payload: reviewedPayload,
      p_reviewed_candidate_hash: body.reviewed_candidate_hash ?? '',
      p_confirm_distinct: body.confirm_distinct ?? false,
    });
    if (error?.code === 'P0002') return errorResponse('Inbox item or review field not found', 404);
    if (error?.code === 'P0001') return errorResponse('Transaction limit reached', 403);
    if (error?.code === '23505' || error?.code === '23514') {
      return errorResponse('Review conflicts with current inbox state', 409);
    }
    if (error?.code === '22023' || error?.code === '22P02' || error?.code === '22008') {
      return errorResponse('Invalid reviewed transaction', 400);
    }
    if (error) return errorResponse('Shortcut creation failed');
    if (data?.status === 'review_required' || data?.status === 'review_overflow') {
      return Response.json(data, { status: 409, headers: privateHeaders });
    }
    if (data?.status !== 'created') return errorResponse('Shortcut creation failed');
    return Response.json(data, { status: data.replayed ? 200 : 201, headers: privateHeaders });
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Shortcut creation failed');
  }
}
