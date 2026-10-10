import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
import { workerConfig } from '@/lib/config';
import {
  inferForwardedAccount,
  inferForwardedBancolombiaAccount,
  inferForwardedAccountFromRules,
} from '@/lib/shortcut-inbox/create-draft';
import { previewBancolombiaNotice } from '@/lib/shortcut-inbox/bancolombia-preview';
import { previewLuloNotice } from '@/lib/shortcut-inbox/lulo-preview';
import {
  categoryFromCurrentRules,
  merchantFromForwardedEvidence,
} from '@/lib/shortcut-inbox/updated-rules';
import type { Account } from '@/types';
import type { AutomationRule } from '@/types/automation-rule';
import {
  recipientFromEmail,
  suggestRecipientHistory,
  type RecipientHistoryRow,
} from '@/lib/shortcut-inbox/recipient-history';
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
  category_source: 'ai' | 'catalog' | 'automation' | 'review_context' | null;
  analysis_version: 2;
  suggested_type: 'expense' | 'income' | null;
  description: string | null;
  notes: string | null;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const privateHeaders = { 'Cache-Control': 'private, no-store' };

function validatedAiEventAt(value: unknown, expectedDate?: string | null): string | null {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:00-05:00$/u.test(value)
  )
    return null;
  if (expectedDate && value.slice(0, 10) !== expectedDate) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value.slice(0, 10)
    ? value
    : null;
}

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
    const rawText = inboxFields.raw_text;
    const preview = previewLuloNotice(
      inboxFields.source,
      inboxFields.raw_text,
      inboxFields.received_at,
    );
    const parsed = preview?.kind === 'card_purchase' && preview.confidence === 'structured';
    let accountId: string | null = null;
    let categoryId: string | null = null;
    let categorySource: 'ai' | 'catalog' | 'automation' | 'review_context' | null = null;

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
          .select('name,rule_type,is_active,priority,condition_logic,conditions,actions')
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
    const bank = previewBancolombiaNotice(inboxFields.source, inboxFields.raw_text);
    const ruleCategoryId = categoryFromCurrentRules(
      preview?.merchant ||
        merchantFromForwardedEvidence(rawText) ||
        (typeof cachedFields?.description === 'string' ? cachedFields.description : ''),
      inboxFields.raw_text,
      preview?.amountDecimal
        ? Number(preview.amountDecimal)
        : bank?.amountDecimal
          ? Number(bank.amountDecimal)
          : typeof cachedFields?.amount === 'number'
            ? cachedFields.amount
            : null,
      accountId,
      currentRules,
    );
    let validRuleCategory: string | null = null;
    const bankPreview = previewBancolombiaNotice(inboxFields.source, inboxFields.raw_text);
    const cachedType =
      (bankPreview?.kind === 'income' ? 'income' : null) ??
      cached?.suggested_type ??
      (bankPreview
        ? bankPreview.kind === 'income'
          ? 'income'
          : 'expense'
        : /\b(?:Transferiste|Compraste|Pagaste|Retiraste)\b/iu.test(inboxFields.raw_text)
          ? 'expense'
          : null);
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

    let recipientHistory: RecipientHistoryRow | null = null;
    const recipient = recipientFromEmail(rawText);
    if (!validRuleCategory && recipient && accountId && cachedType === 'expense') {
      const { data: historyRows, error: historyError } = await supabase
        .from('transactions')
        .select('category_id,description,notes,raw_text')
        .eq('user_id', userId)
        .eq('account_id', accountId)
        .eq('type', 'expense')
        .is('deleted_at', null)
        .ilike('raw_text', `%${recipient}%`)
        .order('date', { ascending: false })
        .limit(21);
      if (historyError) return errorResponse('Email history lookup failed');
      if (Array.isArray(historyRows) && historyRows.length < 21) {
        const proposedHistory = suggestRecipientHistory(
          recipient,
          historyRows as RecipientHistoryRow[],
        );
        if (proposedHistory?.category_id && uuid.test(proposedHistory.category_id)) {
          const { data: category, error: categoryError } = await supabase
            .from('categories')
            .select('id')
            .eq('user_id', userId)
            .eq('id', proposedHistory.category_id)
            .eq('type', 'expense')
            .eq('is_active', true)
            .maybeSingle();
          if (categoryError) return errorResponse('Email history category lookup failed');
          if (category) {
            validRuleCategory = category.id;
            recipientHistory = proposedHistory;
          }
        }
      }
    }

    const matchedRule = validRuleCategory
      ? [...currentRules]
          .sort((a, b) => b.priority - a.priority)
          .find(
            (rule) =>
              categoryFromCurrentRules(
                preview?.merchant ||
                  merchantFromForwardedEvidence(rawText) ||
                  (typeof cachedFields?.description === 'string' ? cachedFields.description : ''),
                rawText,
                preview?.amountDecimal
                  ? Number(preview.amountDecimal)
                  : bankPreview?.amountDecimal
                    ? Number(bankPreview.amountDecimal)
                    : typeof cachedFields?.amount === 'number'
                      ? cachedFields.amount
                      : null,
                accountId,
                [rule],
              ) === validRuleCategory,
          )
      : undefined;
    const ruleNote = (matchedRule?.actions.add_note ?? recipientHistory?.notes)
      ?.trim()
      .slice(0, 500);
    const ruleDescription = (matchedRule?.name ?? recipientHistory?.description)
      ?.trim()
      .slice(0, 150);
    const automationFields = matchedRule
      ? ['categoryId', ...(ruleDescription ? ['description'] : []), ...(ruleNote ? ['notes'] : [])]
      : [];

    const sourceEvidence = {
      merchant: preview?.merchant ?? bankPreview?.merchant ?? null,
      amount: preview?.amountDecimal
        ? Number(preview.amountDecimal)
        : bankPreview?.amountDecimal
          ? Number(bankPreview.amountDecimal)
          : null,
      bank_event_at:
        preview?.bankEventAt ??
        (bankPreview?.date && bankPreview.time
          ? `${bankPreview.date}T${bankPreview.time}:00-05:00`
          : null),
      card_last_four:
        preview?.cardLastFour ??
        bankPreview?.destinationLastFour ??
        bankPreview?.sourceLastFour ??
        null,
    };
    let suggestionRequest: Promise<{ response: Response | null; payload: unknown }> | null = null;
    const loadSuggestion = (): Promise<{ response: Response | null; payload: unknown }> => {
      suggestionRequest ??= (async (): Promise<{ response: Response | null; payload: unknown }> => {
        const token = accessToken ?? (await supabase.auth.getSession()).data.session?.access_token;
        if (!token) throw new AuthError();
        if (!workerConfig.url) return { response: null, payload: null };
        try {
          const response = await fetch(
            `${workerConfig.url.replace(/\/$/u, '')}/forwarded-email/suggest`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ message: rawText }),
              signal: AbortSignal.timeout(50_000),
            },
          );
          return { response, payload: response.ok ? ((await response.json()) as unknown) : null };
        } catch {
          return { response: null, payload: null };
        }
      })();
      return suggestionRequest;
    };
    const suggestionError = async (response: Response | null): Promise<Response | null> => {
      if (!response || response.ok) return null;
      const consentError = await forwardAiConsentError(response);
      if (consentError) return consentError;
      return [401, 403, 428, 429].includes(response.status)
        ? errorResponse('Email suggestion unavailable', response.status)
        : null;
    };
    let timeFallbackUnavailable = false;
    if (
      !sourceEvidence.bank_event_at &&
      !cachedFields?.bank_event_at &&
      /\b\d{1,2}:\d{2}\b/u.test(rawText)
    ) {
      const { response, payload } = await loadSuggestion();
      const failure = await suggestionError(response);
      if (failure) return failure;
      timeFallbackUnavailable = !response?.ok;
      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        sourceEvidence.bank_event_at = validatedAiEventAt(
          (payload as Record<string, unknown>).bank_event_at,
          bankPreview?.date,
        );
      }
    }
    const evidencePatch = Object.fromEntries(
      Object.entries(sourceEvidence).filter(([key, value]) => {
        if (value === null) return false;
        const previous = cachedFields?.[key];
        return key === 'bank_event_at' && typeof previous === 'string' && typeof value === 'string'
          ? Date.parse(previous) !== Date.parse(value)
          : previous !== value;
      }),
    );

    if (cached?.analysis_version === 2) {
      const nextCategory =
        validRuleCategory ??
        (cached.category_source === 'automation' ||
        (bankPreview?.kind === 'income' && cached.suggested_type !== 'income')
          ? null
          : cached.category_id);
      const nextSource = validRuleCategory
        ? matchedRule
          ? 'automation'
          : 'review_context'
        : !nextCategory || cached.category_source === 'automation'
          ? null
          : cached.category_source;
      if (
        (!ruleNote || cached.notes === ruleNote) &&
        (!ruleDescription || cached.description === ruleDescription) &&
        cached.suggested_type === cachedType &&
        cached.account_id === accountId &&
        cached.category_id === nextCategory &&
        cached.category_source === nextSource
      )
        return Response.json(
          {
            ...cached,
            ...evidencePatch,
            analysis_source: matchedRule
              ? 'automation'
              : recipientHistory
                ? 'history'
                : bankPreview?.destinationLastFour
                  ? 'evidence'
                  : 'ai',
            automation_fields: automationFields,
            history_fields: recipientHistory
              ? ['categoryId', 'description', ...(ruleNote ? ['notes'] : [])]
              : [],
          },
          { headers: privateHeaders },
        );
      const { data: updated, error: updateError } = await supabase
        .from('forwarded_email_analyses')
        .update({
          suggested_type: cachedType,
          account_id: accountId,
          category_id: nextCategory,
          category_source: nextSource,
          ...(ruleNote ? { notes: ruleNote } : {}),
          ...(ruleDescription ? { description: ruleDescription } : {}),
        })
        .eq('inbox_item_id', id)
        .eq('user_id', userId)
        .select('*')
        .maybeSingle();
      if (updateError || !updated) return errorResponse('Email analysis failed');
      return Response.json(
        {
          ...updated,
          ...evidencePatch,
          analysis_source: matchedRule
            ? 'automation'
            : recipientHistory
              ? 'history'
              : bankPreview?.destinationLastFour
                ? 'evidence'
                : 'ai',
          automation_fields: automationFields,
          history_fields: recipientHistory
            ? ['categoryId', 'description', ...(ruleNote ? ['notes'] : [])]
            : [],
        },
        { headers: privateHeaders },
      );
    }

    const cardRepayment =
      bankPreview?.kind === 'payment' &&
      Boolean(
        bankPreview.destinationLastFour &&
        bankPreview.sourceLastFour &&
        bankPreview.amountDecimal &&
        bankPreview.date,
      );
    let suggestion: Record<string, unknown>;
    let aiUnavailable = false;
    if ((matchedRule || recipientHistory) && cachedType) {
      suggestion = {
        type: cachedType,
        category_id: validRuleCategory,
        category_source: 'automation',
        description: ruleDescription ?? ruleNote ?? null,
        notes: ruleNote ?? null,
      };
    } else if (cardRepayment) {
      suggestion = { type: null, category_id: null, description: null, notes: null };
    } else {
      const { response: suggestionResponse, payload } = await loadSuggestion();
      const failure = await suggestionError(suggestionResponse);
      if (failure) return failure;
      if (
        suggestionResponse?.ok &&
        payload &&
        typeof payload === 'object' &&
        !Array.isArray(payload) &&
        'type' in payload &&
        (payload.type === null || payload.type === 'expense' || payload.type === 'income')
      ) {
        suggestion = payload as Record<string, unknown>;
      } else {
        aiUnavailable = true;
        suggestion = {
          type: parsed
            ? 'expense'
            : bankPreview?.kind === 'income'
              ? 'income'
              : bankPreview
                ? 'expense'
                : null,
          category_id: null,
          description: sourceEvidence.merchant,
          notes: null,
        };
      }
    }
    const suggestedType =
      bankPreview?.kind === 'income'
        ? 'income'
        : parsed
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
    if (validRuleCategory && uuid.test(validRuleCategory) && suggestedType) {
      const { data: category, error: categoryError } = await supabase
        .from('categories')
        .select('id')
        .eq('id', validRuleCategory)
        .eq('user_id', userId)
        .eq('type', suggestedType)
        .eq('is_active', true)
        .maybeSingle();
      if (categoryError) return errorResponse('Email category analysis failed');
      if (category) {
        categoryId = category.id;
        categorySource = matchedRule ? 'automation' : 'review_context';
      }
    }

    sourceEvidence.bank_event_at ??=
      validatedAiEventAt(suggestion.bank_event_at, bankPreview?.date) ??
      validatedAiEventAt(cachedFields?.bank_event_at);
    const analysis: EmailAnalysis = {
      inbox_item_id: id,
      user_id: userId,
      status: parsed ? 'parsed' : 'needs_review',
      ...sourceEvidence,
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
    if (aiUnavailable || timeFallbackUnavailable) {
      // Do not cache degraded proposals: the next analysis must retry enrichment.
      return Response.json(
        {
          ...analysis,
          analysis_source: 'evidence',
          ai_status: 'unavailable',
          automation_fields: [],
          history_fields: [],
        },
        { headers: privateHeaders },
      );
    }
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
      return Response.json(
        {
          ...updated,
          ...sourceEvidence,
          analysis_source: matchedRule
            ? 'automation'
            : recipientHistory
              ? 'history'
              : bankPreview?.destinationLastFour
                ? 'evidence'
                : 'ai',
          automation_fields: automationFields,
          history_fields: recipientHistory
            ? ['categoryId', 'description', ...(ruleNote ? ['notes'] : [])]
            : [],
        },
        { headers: privateHeaders },
      );
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
    return Response.json(
      {
        ...inserted,
        analysis_source: matchedRule
          ? 'automation'
          : recipientHistory
            ? 'history'
            : bankPreview?.destinationLastFour
              ? 'evidence'
              : 'ai',
        automation_fields: automationFields,
        history_fields: recipientHistory
          ? ['categoryId', 'description', ...(ruleNote ? ['notes'] : [])]
          : [],
      },
      { status: 201, headers: privateHeaders },
    );
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Email analysis failed');
  }
}
