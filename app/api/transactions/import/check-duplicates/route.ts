import type { NextRequest } from 'next/server';
import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';

interface CheckTransaction {
  date: string;
  amount: number;
  account: string;
}

interface CheckBody {
  transactions: CheckTransaction[];
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { supabase } = await getUserClient();
    const body = (await request.json()) as CheckBody;

    if (!Array.isArray(body.transactions) || body.transactions.length === 0) {
      return jsonResponse({ duplicates: [] });
    }

    // Resolve account names to IDs
    const { data: accounts } = await supabase.from('accounts').select('id, name');
    const accountsByName = new Map<string, string>();
    for (const a of accounts ?? []) {
      accountsByName.set((a.name as string).toLowerCase(), a.id as string);
    }

    // Build unique (date, amount, account_id) combos and map back to indices
    const combos: { date: string; amount: number; account_id: string; indices: number[] }[] = [];
    const comboMap = new Map<string, number>(); // key -> combos index

    for (let i = 0; i < body.transactions.length; i++) {
      const tx = body.transactions[i];
      const accountId = accountsByName.get(tx.account.toLowerCase());
      if (!accountId) continue;

      const key = `${tx.date}|${tx.amount}|${accountId}`;
      const existing = comboMap.get(key);
      if (existing !== undefined) {
        combos[existing].indices.push(i);
      } else {
        comboMap.set(key, combos.length);
        combos.push({ date: tx.date, amount: tx.amount, account_id: accountId, indices: [i] });
      }
    }

    if (combos.length === 0) {
      return jsonResponse({ duplicates: [] });
    }

    // Batch check: query for all potential duplicates using OR conditions
    // Process in chunks to avoid overly large queries
    const CHUNK_SIZE = 50;
    const duplicates: {
      index: number;
      match: { id: string; date: string; amount: number; description: string; account_id: string };
    }[] = [];

    for (let c = 0; c < combos.length; c += CHUNK_SIZE) {
      const chunk = combos.slice(c, c + CHUNK_SIZE);
      const orConditions = chunk
        .map(
          (combo) =>
            `and(date.eq.${combo.date},amount.eq.${combo.amount},account_id.eq.${combo.account_id})`,
        )
        .join(',');

      const { data: matches } = await supabase
        .from('transactions')
        .select('id, date, amount, description, account_id')
        .is('deleted_at', null)
        .or(orConditions);

      if (!matches) continue;

      // Map matches back to import indices
      for (const match of matches) {
        const key = `${match.date as string}|${match.amount as number}|${match.account_id as string}`;
        const comboIdx = comboMap.get(key);
        if (comboIdx === undefined) continue;

        for (const importIdx of combos[comboIdx].indices) {
          duplicates.push({
            index: importIdx,
            match: {
              id: match.id as string,
              date: match.date as string,
              amount: match.amount as number,
              description: match.description as string,
              account_id: match.account_id as string,
            },
          });
        }
      }
    }

    return jsonResponse({ duplicates });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to check duplicates');
  }
}
