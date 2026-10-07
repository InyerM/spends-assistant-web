import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
import { workerConfig } from '@/lib/config';
import {
  inferForwardedAccount,
  inferForwardedBancolombiaAccount,
  inferForwardedAccountFromRules,
} from '@/lib/shortcut-inbox/create-draft';
import { previewLuloNotice } from '@/lib/shortcut-inbox/lulo-preview';
import {
  categoryFromCurrentRules,
  merchantFromForwardedEvidence,
} from '@/lib/shortcut-inbox/updated-rules';
import type { Account } from '@/types';
import type { AutomationRule } from '@/types/automation-rule';
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
  category_source: 'ai' | 'catalog' | 'automation' | null;
  analysis_version: 2;
  suggested_type: 'expense' | 'income' | null;
  description: string | null;
  notes: string | null;
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
    if (cached?.analysis_version === 2 && inbox.status !== 'pending') {
      return Response.json(cached, { headers: privateHeaders });
    }
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
    let categorySource: 'ai' | 'catalog' | 'automation' | null = null;

    const [{ data: accounts, error: accountsError }, { data: rules, error: rulesError }] =
      await Promise.all([
        supabase
          .from('accounts')
          .select(
            'id,name,institution,type,last_four,bank_account_last_four,identifiers,currency,is_active,deleted_at',
          )
          .eq('user_id', userId),
        supabase
          .from('automation_rules')
          .select('rule_type,is_active,priority,condition_logic,conditions,actions')
          .eq('user_id', userId)
          .eq('is_active', true)
          .is('deleted_at', null),
      ]);
    if (accountsError || rulesError) return errorResponse('Email account analysis failed');
    const ownedAccounts = Array.isArray(accounts) ? (accounts as Account[]) : [];
    accountId =
      inferForwardedAccount(preview, ownedAccounts) ||
      inferForwardedBancolombiaAccount(inboxFields.raw_text, ownedAccounts) ||
      inferForwardedAccountFromRules(
        inboxFields.raw_text,
        ownedAccounts,
        Array.isArray(rules) ? (rules as AutomationRule[]) : [],
      ) ||
      null;

    const currentRules = Array.isArray(rules) ? (rules as AutomationRule[]) : [];
    const cachedFields = cached as Record<string, unknown> | null;
    const ruleCategoryId = categoryFromCurrentRules(
      preview?.merchant ||
        merchantFromForwardedEvidence(inboxFields.raw_text) ||
        (typeof cachedFields?.description === 'string' ? cachedFields.description : ''),
      inboxFields.raw_text,
      preview?.amountDecimal
        ? Number(preview.amountDecimal)
        : typeof cachedFields?.amount === 'number'
          ? cachedFields.amount
          : null,
      accountId,
      currentRules,
    );
    let validRuleCategory: string | null = null;
    const cachedType = cached?.suggested_type;
    if (
      ruleCategoryId &&
      uuid.test(ruleCategoryId) &&
      (cachedType === 'expense' || cachedType === 'income')
    ) {
      const { data: category, error: categoryError } = await supabase
        .from('categories')
        .select('id')
        .eq('id', ruleCategoryId)
        .eq('user_id', userId)
        .eq('type', cachedType)
        .eq('is_active', true)
        .maybeSingle();
      if (categoryError) return errorResponse('Email category analysis failed');
      validRuleCategory = category?.id ?? null;
    }

    if (cached?.analysis_version === 2) {
      const nextCategory =
        cached.category_source === 'review_context'
          ? cached.category_id
          : (validRuleCategory ??
            (cached.category_source === 'automation' ? null : cached.category_id));
      const nextSource =
        cached.category_source === 'review_context'
          ? cached.category_source
          : validRuleCategory
            ? 'automation'
            : cached.category_source === 'automation'
              ? null
              : cached.category_source;
      if (
        cached.account_id === accountId &&
        cached.category_id === nextCategory &&
        cached.category_source === nextSource
      )
        return Response.json(cached, { headers: privateHeaders });
      const { data: updated, error: updateError } = await supabase
        .from('forwarded_email_analyses')
        .update({ account_id: accountId, category_id: nextCategory, category_source: nextSource })
        .eq('inbox_item_id', id)
        .eq('user_id', userId)
        .select('*')
        .maybeSingle();
      if (updateError || !updated) return errorResponse('Email analysis failed');
      return Response.json(updated, { headers: privateHeaders });
    }

    if (!workerConfig.url) return errorResponse('Email suggestion unavailable', 503);
    const token = accessToken ?? (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return errorResponse('Unauthorized', 401);
    const suggestionResponse = await fetch(
      `${workerConfig.url.replace(/\/$/u, '')}/forwarded-email/suggest`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: inboxFields.raw_text }),
      },
    );
    if (!suggestionResponse.ok) {
      const consentError = await forwardAiConsentError(suggestionResponse);
      return consentError ?? errorResponse('Email suggestion unavailable', 503);
    }
    const suggestion = (await suggestionResponse.json()) as Record<string, unknown>;
    const suggestedType = parsed
      ? 'expense'
      : suggestion.type === 'expense' || suggestion.type === 'income'
        ? suggestion.type
        : null;
    if (
      suggestedType &&
      typeof suggestion.category_id === 'string' &&
      uuid.test(suggestion.category_id)
    ) {
      const { data: category, error: categoryError } = await supabase
        .from('categories')
        .select('id')
        .eq('id', suggestion.category_id)
        .eq('user_id', userId)
        .eq('type', suggestedType)
        .eq('is_active', true)
        .maybeSingle();
      if (categoryError) return errorResponse('Email category analysis failed');
      if (category) {
        categoryId = category.id;
        categorySource = suggestion.category_source === 'catalog' ? 'catalog' : 'ai';
      }
    }
    if (ruleCategoryId && uuid.test(ruleCategoryId) && suggestedType) {
      const { data: category, error: categoryError } = await supabase
        .from('categories')
        .select('id')
        .eq('id', ruleCategoryId)
        .eq('user_id', userId)
        .eq('type', suggestedType)
        .eq('is_active', true)
        .maybeSingle();
      if (categoryError) return errorResponse('Email category analysis failed');
      if (category) {
        categoryId = category.id;
        categorySource = 'automation';
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
      analysis_version: 2,
      suggested_type: suggestedType,
      description:
        typeof suggestion.description === 'string' && suggestion.description.trim().length <= 150
          ? suggestion.description.trim() || null
          : null,
      notes:
        typeof suggestion.notes === 'string' && suggestion.notes.trim().length <= 500
          ? suggestion.notes.trim() || null
          : null,
    };
    if (cached) {
      const { data: updated, error: updateError } = await supabase
        .from('forwarded_email_analyses')
        .update({
          analysis_version: 2,
          suggested_type: analysis.suggested_type,
          description: analysis.description,
          notes: analysis.notes,
          account_id: analysis.account_id,
          category_id: analysis.category_id,
          category_source: analysis.category_source,
        })
        .eq('inbox_item_id', id)
        .eq('user_id', userId)
        .select('*')
        .maybeSingle();
      if (updateError || !updated) return errorResponse('Email analysis failed');
      return Response.json(updated, { headers: privateHeaders });
    }
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
