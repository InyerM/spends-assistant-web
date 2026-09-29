import type { NextRequest } from 'next/server';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
import {
  extractCandidateEvidence,
  MAX_CANDIDATES,
  rankCandidates,
  type CandidateTransaction,
} from '@/lib/shortcut-inbox/candidates';

interface Context {
  params: Promise<{ id: string }>;
}

const transactionFields = 'id,date,amount,account_id,description,type,source';

export async function GET(_request: NextRequest, context: Context): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();
    const { id } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(id)) {
      return errorResponse('Invalid inbox item ID', 400);
    }
    const { data: inbox, error: inboxError } = await supabase
      .from('shortcut_inbox_items')
      .select('id,raw_text')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    if (inboxError?.code === 'PGRST116') return errorResponse('Inbox item not found', 404);
    if (inboxError) return errorResponse('Candidate lookup failed');

    const evidence = extractCandidateEvidence(inbox.raw_text as string);
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
        .select('id')
        .eq('user_id', userId)
        .eq('last_four', evidence.lastFour)
        .is('deleted_at', null)
        .limit(2);
      if (accountError) return errorResponse('Candidate lookup failed');
      if (accounts.length === 0) account = 'missing';
      else if (accounts.length > 1) account = 'ambiguous';
      else {
        account = 'unique';
        const { data, error } = await supabase
          .from('transactions')
          .select(transactionFields)
          .eq('user_id', userId)
          .eq('date', evidence.date)
          .eq('amount', Number(evidence.amount))
          .eq('account_id', accounts[0].id)
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
