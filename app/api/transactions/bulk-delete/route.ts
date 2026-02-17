import type { NextRequest } from 'next/server';
import {
  getUserClient,
  AuthError,
  jsonResponse,
  errorResponse,
  applyTransactionBalance,
} from '@/lib/api/server';

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { supabase } = await getUserClient();
    const body = (await request.json()) as { ids: string[] };

    if (!body.ids.length) {
      return errorResponse('ids are required', 400);
    }

    // Fetch all transactions to reverse their balances
    const { data: transactions, error: fetchError } = await supabase
      .from('transactions')
      .select('id, type, amount, account_id, transfer_to_account_id')
      .in('id', body.ids)
      .is('deleted_at', null);

    if (fetchError) return errorResponse(fetchError.message, 400);
    if (!transactions.length) return errorResponse('No transactions found', 404);

    // Soft-delete all transactions in one query
    const { error: deleteError } = await supabase
      .from('transactions')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', body.ids)
      .is('deleted_at', null);

    if (deleteError) return errorResponse(deleteError.message, 400);

    // Reverse balances for each deleted transaction
    await Promise.all(
      transactions.map((tx) =>
        applyTransactionBalance(
          supabase,
          tx.type as string,
          tx.account_id as string,
          tx.amount as number,
          tx.transfer_to_account_id as string | null,
          true,
        ),
      ),
    );

    return jsonResponse({ success: true, deletedCount: transactions.length });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to bulk delete transactions');
  }
}
