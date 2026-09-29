import type { NextRequest } from 'next/server';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
import {
  dateWindow,
  rankCandidates,
  type ReconciliationObservation,
  type ReconciliationTransaction,
} from '@/lib/document-reconciliation';

const SEARCH_LIMIT = 100;
const DISPLAY_LIMIT = 5;

interface StoredObservation extends ReconciliationObservation {
  status: string;
}

type StoredTransaction = Omit<ReconciliationTransaction, 'account_name'>;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();
    const { id } = await params;
    const { data: rawDocument, error: documentError } = await supabase
      .from('documents')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    const document = rawDocument as { status: string } | null;
    if (documentError || !document) return errorResponse('Document not found', 404);
    if (document.status !== 'extracted') return errorResponse('Document is not extracted', 409);

    const { data: rawObservations, error: observationError } = await supabase
      .from('document_observations')
      .select('id, amount, occurred_at_text, description, counterparty, reference, status')
      .eq('document_id', id)
      .eq('user_id', userId)
      .order('ordinal', { ascending: true });
    if (observationError) return errorResponse('Failed to load observations');
    const observations = (rawObservations as StoredObservation[] | null) ?? [];
    const transactionCache = new Map<string, StoredTransaction[]>();
    const limitedKeys = new Set<string>();

    for (const observation of observations) {
      if (
        observation.status !== 'pending' ||
        observation.amount === null ||
        !Number.isFinite(observation.amount) ||
        observation.amount <= 0
      )
        continue;
      const window = dateWindow(observation.occurred_at_text);
      const key = `${observation.amount}:${window?.from ?? 'any'}`;
      if (transactionCache.has(key)) continue;

      let query = supabase
        .from('transactions')
        .select('id, amount, date, description, account_id, type, raw_text')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .eq('amount', observation.amount);
      if (window) query = query.gte('date', window.from).lte('date', window.to);
      const { data, error } = await query.order('date', { ascending: false }).limit(SEARCH_LIMIT);
      if (error) return errorResponse('Failed to search transactions');
      const rows = (data as StoredTransaction[] | null) ?? [];
      transactionCache.set(key, rows);
      if (rows.length === SEARCH_LIMIT) limitedKeys.add(key);
    }

    const accountIds = [
      ...new Set(
        [...transactionCache.values()].flatMap((rows) => rows.map((row) => row.account_id)),
      ),
    ];
    const accountNames = new Map<string, string>();
    if (accountIds.length > 0) {
      const { data: accounts, error: accountError } = await supabase
        .from('accounts')
        .select('id, name')
        .eq('user_id', userId)
        .in('id', accountIds);
      if (accountError) return errorResponse('Failed to load accounts');
      for (const account of (accounts as { id: string; name: string }[] | null) ?? [])
        accountNames.set(account.id as string, account.name as string);
    }

    const data = observations.map((observation) => {
      const window = dateWindow(observation.occurred_at_text);
      const key = `${observation.amount}:${window?.from ?? 'any'}`;
      const rows = transactionCache.get(key) ?? [];
      const ranked =
        observation.status === 'pending'
          ? rankCandidates(
              observation,
              rows.map((row) => ({
                ...row,
                account_name: accountNames.get(row.account_id) ?? null,
              })),
            )
          : [];
      return {
        observation_id: observation.id,
        status: observation.status,
        candidates: ranked.slice(0, DISPLAY_LIMIT),
        total_candidates: ranked.length,
        search_limited: limitedKeys.has(key),
      };
    });
    return Response.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Failed to load suggestions');
  }
}
