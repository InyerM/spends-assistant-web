import { inferForwardedAccountFromRules } from '@/lib/shortcut-inbox/create-draft';
import type { AutomationRule } from '@/types/automation-rule';
import type { NextRequest } from 'next/server';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
import {
  extractCandidateEvidence,
  MAX_CANDIDATES,
  rankCandidates,
  type CandidateTransaction,
} from '@/lib/shortcut-inbox/candidates';
import { previewLuloNotice } from '@/lib/shortcut-inbox/lulo-preview';
import { previewBancolombiaNotice } from '@/lib/shortcut-inbox/bancolombia-preview';
import { accountIdentifiers } from '@/lib/accounts/identifiers';
import type { Account } from '@/types/account';

interface Context {
  params: Promise<{ id: string }>;
}

const transactionFields = 'id,date,amount,account_id,description,type,source';

export async function GET(request: NextRequest, context: Context): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient(request);
    const { id } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(id)) {
      return errorResponse('Invalid inbox item ID', 400);
    }
    const { data: inbox, error: inboxError } = await supabase
      .from('shortcut_inbox_items')
      .select('id,source,received_at,raw_text')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    if (inboxError?.code === 'PGRST116') return errorResponse('Inbox item not found', 404);
    if (inboxError) return errorResponse('Candidate lookup failed');

    const ownedInbox = inbox as { source: string; raw_text: string; received_at: string };
    const lulo = previewLuloNotice(ownedInbox.source, ownedInbox.raw_text, ownedInbox.received_at);
    const bank = previewBancolombiaNotice(ownedInbox.source, ownedInbox.raw_text);
    const generic = extractCandidateEvidence(ownedInbox.raw_text);
    const specialized = lulo
      ? lulo.kind === 'card_purchase'
        ? {
            amount: lulo.amountDecimal,
            date: lulo.bankEventAt?.slice(0, 10) ?? null,
            lastFour: lulo.cardLastFour,
          }
        : { amount: null, date: null, lastFour: null }
      : bank
        ? { amount: bank.amountDecimal, date: bank.date, lastFour: bank.sourceLastFour }
        : extractCandidateEvidence(inbox.raw_text as string);
    const evidence = {
      amount: generic.amount ?? specialized.amount,
      date: generic.date ?? specialized.date,
      lastFour: generic.lastFour ?? specialized.lastFour,
    };
    const { data: exactRaw, error: rawError } = await supabase
      .from('transactions')
      .select(transactionFields)
      .eq('user_id', userId)
      .eq('raw_text', inbox.raw_text)
      .is('deleted_at', null)
      .limit(MAX_CANDIDATES);
    if (rawError) return errorResponse('Candidate lookup failed');

    let account: 'unavailable' | 'missing' | 'ambiguous' | 'unique' = 'unavailable';
    let sameTuple: CandidateTransaction[] = [];
    if (evidence.amount && evidence.date && evidence.lastFour) {
      const { data: accounts, error: accountError } = await supabase
        .from('accounts')
        .select(
          'id,name,institution,type,currency,is_active,last_four,bank_account_last_four,identifiers,deleted_at',
        )
        .eq('user_id', userId)
        .is('deleted_at', null)
        .limit(1001);
      if (accountError) return errorResponse('Candidate lookup failed');
      const matching = (accounts as Account[]).filter(
        (row) =>
          (!bank || !row.currency || row.currency === bank.currency) &&
          accountIdentifiers(row).some((identifier) => identifier.last_four === evidence.lastFour),
      );
      if (matching.length === 0 && accounts.length < 1001) {
        const { data: rules, error: rulesError } = await supabase
          .from('automation_rules')
          .select('rule_type,is_active,condition_logic,conditions,actions')
          .eq('user_id', userId)
          .eq('is_active', true)
          .is('deleted_at', null);
        if (rulesError) return errorResponse('Candidate account lookup failed');
        const ruleAccountId = inferForwardedAccountFromRules(
          ownedInbox.raw_text,
          accounts as Account[],
          rules as AutomationRule[],
        );
        const ruleAccount = (accounts as Account[]).find((row) => row.id === ruleAccountId);
        if (ruleAccount) matching.push(ruleAccount);
      }
      if (accounts.length === 1001 || matching.length > 1) account = 'ambiguous';
      else if (matching.length === 0) account = 'missing';
      else {
        account = 'unique';
        const { data, error } = await supabase
          .from('transactions')
          .select(transactionFields)
          .eq('user_id', userId)
          .eq('date', evidence.date)
          .eq('amount', Number(evidence.amount))
          .eq('account_id', matching[0].id)
          .is('deleted_at', null)
          .limit(MAX_CANDIDATES);
        if (error) return errorResponse('Candidate lookup failed');
        sameTuple = data as CandidateTransaction[];
      }
    }

    const candidates = rankCandidates(exactRaw as CandidateTransaction[], sameTuple);
    return Response.json(
      {
        evidence: { amount: evidence.amount, date: evidence.date, account },
        candidates,
        at_limit: candidates.length === MAX_CANDIDATES,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Candidate lookup failed');
  }
}
