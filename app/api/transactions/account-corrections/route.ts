import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';

const privateHeaders = { 'Cache-Control': 'private, no-store' };
const money = z.string().regex(/^(0|[1-9][0-9]{0,12})(?:\.[0-9]{1,2})?$/u);
const correction = z
  .strictObject({
    request_id: z.uuid(),
    transaction_id: z.uuid(),
    match_decision_id: z.uuid(),
    expected_account_id: z.uuid(),
    expected_amount: money,
    new_account_id: z.uuid(),
    new_amount: money.nullable(),
    evidence: z.strictObject({
      document: z.string().trim().min(1).max(120),
      page: z.number().int().min(1).max(999),
      line: z.string().trim().min(1).max(500),
    }),
  })
  .refine((input) => input.expected_account_id !== input.new_account_id)
  .refine((input) => Number(input.expected_amount) > 0)
  .refine((input) => input.new_amount === null || Number(input.new_amount) > 0);

interface AccountRow {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  bank_account_last_four: string | null;
}

interface CandidateRow {
  id: string;
  account_id: string;
  amount: number;
  date: string;
  time: string;
  description: string;
  raw_text: string;
}

interface DecisionRow {
  id: string;
  transaction_id: string;
  inbox_item_id: string;
}

export async function GET(): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();
    const accountsResult = await supabase
      .from('accounts')
      .select('id,name,type,institution,bank_account_last_four,is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .is('deleted_at', null);
    if (accountsResult.error) return errorResponse('Account correction lookup failed');
    const accounts = accountsResult.data as AccountRow[];
    const creditCards = new Set(
      accounts.filter((account) => account.type === 'credit_card').map((account) => account.id),
    );
    const destinations = accounts
      .filter(
        (account) =>
          account.type === 'savings' &&
          account.institution?.toLowerCase() === 'bancolombia' &&
          account.bank_account_last_four === '2651',
      )
      .map(({ id, name }) => ({ id, name }));

    const transactionsResult = await supabase
      .from('transactions')
      .select('id,account_id,amount,date,time,description,raw_text')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .ilike('raw_text', '%T.Deb *9989%')
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .limit(250);
    if (transactionsResult.error) return errorResponse('Account correction lookup failed');
    const candidates = (transactionsResult.data as CandidateRow[]).filter((item) =>
      creditCards.has(item.account_id),
    );
    if (candidates.length === 0) {
      return Response.json({ data: [], destinations }, { headers: privateHeaders });
    }

    const decisionsResult = await supabase
      .from('shortcut_inbox_match_decisions')
      .select('id,transaction_id,inbox_item_id')
      .eq('user_id', userId)
      .eq('decision_type', 'matched')
      .in(
        'transaction_id',
        candidates.map((candidate) => candidate.id),
      );
    if (decisionsResult.error) return errorResponse('Account correction lookup failed');
    const decisions = decisionsResult.data as DecisionRow[];
    const reversed = new Set<string>();
    if (decisions.length > 0) {
      const reversalsResult = await supabase
        .from('shortcut_inbox_match_reversals')
        .select('decision_id')
        .eq('user_id', userId)
        .in(
          'decision_id',
          decisions.map((decision) => decision.id),
        );
      if (reversalsResult.error) return errorResponse('Account correction lookup failed');
      for (const reversal of reversalsResult.data as Array<{ decision_id: string }>) {
        reversed.add(reversal.decision_id);
      }
    }
    const active = new Map(
      decisions
        .filter((decision) => !reversed.has(decision.id))
        .map((decision) => [decision.transaction_id, decision.id]),
    );
    const accountNames = new Map(accounts.map((account) => [account.id, account.name]));
    const data = candidates
      .filter((candidate) => active.has(candidate.id))
      .map((candidate) => ({
        ...candidate,
        match_decision_id: active.get(candidate.id),
        current_account_name: accountNames.get(candidate.account_id) ?? '',
      }));
    return Response.json({ data, destinations }, { headers: privateHeaders });
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Account correction lookup failed');
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { supabase } = await getUserClient();
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
    const parsed = correction.safeParse(input);
    if (!parsed.success) return errorResponse('Invalid reviewed correction', 400);
    const body = parsed.data;
    const { data, error } = await supabase.rpc('correct_shortcut_matched_expense', {
      p_request_id: body.request_id,
      p_transaction_id: body.transaction_id,
      p_match_decision_id: body.match_decision_id,
      p_expected_account_id: body.expected_account_id,
      p_expected_amount: body.expected_amount,
      p_new_account_id: body.new_account_id,
      p_new_amount: body.new_amount,
      p_evidence: { source: 'bank_statement', ...body.evidence },
    });
    if (error?.code === 'P0002') return errorResponse('Reviewed transaction not found', 404);
    if (error?.code === '40001' || error?.code === '23505' || error?.code === '23514') {
      return errorResponse('Correction conflicts with current financial state', 409);
    }
    if (error?.code === '42501' || error?.code.startsWith('22')) {
      return errorResponse('Invalid reviewed correction', 400);
    }
    if (error) return errorResponse('Account correction failed');
    return Response.json(data, { status: data?.replayed ? 200 : 201, headers: privateHeaders });
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Account correction failed');
  }
}
