import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
import { workerConfig } from '@/lib/config';
import { inferForwardedAccount } from '@/lib/shortcut-inbox/create-draft';
import { previewLuloNotice } from '@/lib/shortcut-inbox/lulo-preview';
import type { Account } from '@/types';
import { forwardAiConsentError } from '@/lib/ai-consent';

interface Context {
  params: Promise<{ id: string }>;
}

interface EmailAnalysis {
  inbox_item_id: string;
  user_id: string;
  status: 'parsed' | 'needs_review';
  merchant: string | null;
  amount: number | null;
  bank_event_at: string | null;
  card_last_four: string | null;
  account_id: string | null;
  category_id: string | null;
  category_source: 'ai' | 'catalog' | null;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const privateHeaders = { 'Cache-Control': 'private, no-store' };

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const { supabase, userId, accessToken } = await getUserClient(request);
    if (!accessToken && request.headers.get('Origin') !== new URL(request.url).origin) {
      return errorResponse('Invalid request origin', 403);
    }
    const { id } = await context.params;
    if (!uuid.test(id)) return errorResponse('Invalid inbox item ID', 400);

    const [{ data: inbox, error: inboxError }, { data: route, error: routeError }] =
      await Promise.all([
        supabase
          .from('shortcut_inbox_items')
          .select('id,user_id,source,status,received_at,raw_text')
          .eq('id', id)
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('email_forwarding_routes')
          .select('confirmation_received_at,user_confirmed_at')
          .eq('user_id', userId)
          .maybeSingle(),
      ]);
    if (inboxError || routeError) return errorResponse('Email analysis lookup failed');
    if (!inbox || inbox.source !== 'forwarded_email')
      return errorResponse('Inbox item not found', 404);
    if (!route?.confirmation_received_at || !route.user_confirmed_at)
      return errorResponse('Email forwarding is not verified', 403);

    const { data: cached, error: cacheError } = await supabase
      .from('forwarded_email_analyses')
      .select('*')
      .eq('inbox_item_id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (cacheError) return errorResponse('Email analysis lookup failed');
    if (cached) return Response.json(cached, { headers: privateHeaders });
    if (inbox.status !== 'pending') return errorResponse('Inbox item is not pending', 409);

    const inboxFields: Record<string, unknown> = inbox;
    if (
      typeof inboxFields.source !== 'string' ||
      typeof inboxFields.raw_text !== 'string' ||
      typeof inboxFields.received_at !== 'string'
    ) {
      return errorResponse('Inbox item has invalid email data', 422);
    }
    const preview = previewLuloNotice(
      inboxFields.source,
      inboxFields.raw_text,
      inboxFields.received_at,
    );
    const parsed = preview?.kind === 'card_purchase' && preview.confidence === 'structured';
    let accountId: string | null = null;
    let categoryId: string | null = null;
    let categorySource: 'ai' | 'catalog' | null = null;

    if (parsed && preview.merchant) {
      const { data: accounts, error: accountsError } = await supabase
        .from('accounts')
        .select('id,name,institution,type,last_four,currency,is_active,deleted_at')
        .eq('user_id', userId);
      if (accountsError) return errorResponse('Email account analysis failed');
      accountId =
        inferForwardedAccount(preview, Array.isArray(accounts) ? (accounts as Account[]) : []) ||
        null;

      if (!workerConfig.url) return errorResponse('Merchant classification unavailable', 503);
      const token = accessToken ?? (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return errorResponse('Unauthorized', 401);
      const response = await fetch(`${workerConfig.url.replace(/\/$/u, '')}/merchant/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ merchant: preview.merchant }),
      });
      if (!response.ok) {
        const consentError = await forwardAiConsentError(response);
        return consentError ?? errorResponse('Merchant classification unavailable', 503);
      }
      const suggestion = (await response.json()) as { category_id?: unknown; source?: unknown };
      if (
        typeof suggestion.category_id === 'string' &&
        uuid.test(suggestion.category_id) &&
        (suggestion.source === 'ai' || suggestion.source === 'catalog')
      ) {
        const { data: category, error: categoryError } = await supabase
          .from('categories')
          .select('id')
          .eq('id', suggestion.category_id)
          .eq('user_id', userId)
          .eq('type', 'expense')
          .eq('is_active', true)
          .maybeSingle();
        if (categoryError) return errorResponse('Email category analysis failed');
        if (category) {
          categoryId = category.id;
          categorySource = suggestion.source;
        }
      }
    }

    const analysis: EmailAnalysis = {
      inbox_item_id: id,
      user_id: userId,
      status: parsed ? 'parsed' : 'needs_review',
      merchant: parsed ? preview.merchant : null,
      amount: parsed ? Number(preview.amountDecimal) : null,
      bank_event_at: parsed ? preview.bankEventAt : null,
      card_last_four: parsed ? preview.cardLastFour : null,
      account_id: accountId,
      category_id: categoryId,
      category_source: categorySource,
    };
    const { data: inserted, error: insertError } = await supabase
      .from('forwarded_email_analyses')
      .insert(analysis)
      .select('*')
      .maybeSingle();
    if (insertError?.code === '23505') {
      const { data: replay, error: replayError } = await supabase
        .from('forwarded_email_analyses')
        .select('*')
        .eq('inbox_item_id', id)
        .eq('user_id', userId)
        .maybeSingle();
      if (replayError || !replay) return errorResponse('Email analysis conflict', 409);
      return Response.json(replay, { headers: privateHeaders });
    }
    if (insertError || !inserted) return errorResponse('Email analysis failed');
    return Response.json(inserted, { status: 201, headers: privateHeaders });
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Email analysis failed');
  }
}
