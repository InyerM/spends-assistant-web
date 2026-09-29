import type { NextRequest } from 'next/server';
import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';
import { findImportDuplicates, resolveImportReferences } from '@/lib/api/import';
import { validateImportRows } from '@/lib/utils/import-duplicates';

interface CheckTransaction {
  date: string;
  amount: number;
  account?: string;
  account_id?: string;
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { supabase } = await getUserClient();
    const body = (await request.json()) as { transactions?: unknown };

    if (Array.isArray(body.transactions) && body.transactions.length === 0) {
      return jsonResponse({ duplicates: [], unresolved_accounts: [] });
    }
    const invalid = validateImportRows(body.transactions);
    if (invalid) return errorResponse(invalid, 400);

    const transactions = body.transactions as CheckTransaction[];
    const { accountIds, unresolvedAccounts } = await resolveImportReferences(
      supabase,
      transactions.map((tx) => ({ account: tx.account, account_id: tx.account_id })),
    );
    const duplicates = await findImportDuplicates(
      supabase,
      transactions.map((tx, i) => ({
        date: tx.date,
        amount: tx.amount,
        account_id: accountIds[i],
      })),
    );

    return jsonResponse({ duplicates, unresolved_accounts: unresolvedAccounts });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to check duplicates');
  }
}
