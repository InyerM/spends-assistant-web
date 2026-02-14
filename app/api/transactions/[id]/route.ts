import type { NextRequest } from 'next/server';
import {
  getUserClient,
  AuthError,
  jsonResponse,
  errorResponse,
  applyTransactionBalance,
} from '@/lib/api/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams): Promise<Response> {
  try {
    const { id } = await params;
    const { supabase } = await getUserClient();

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) return errorResponse(error.message, 404);
    return jsonResponse(data);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to fetch transaction');
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<Response> {
  try {
    const { id } = await params;
    const { supabase } = await getUserClient();
    const body = await request.json();

    // Fetch old transaction to reverse its balance effect
    const { data: old } = await supabase
      .from('transactions')
      .select('type, amount, account_id, transfer_to_account_id')
      .eq('id', id)
      .single();

    const { data, error } = await supabase
      .from('transactions')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) return errorResponse(error.message, 400);

    // If amount, type, or account changed, reverse old and apply new
    if (old) {
      const amountChanged = (body.amount !== undefined && body.amount !== old.amount) as boolean;
      const typeChanged = (body.type !== undefined && body.type !== old.type) as boolean;
      const accountChanged = (body.account_id !== undefined &&
        body.account_id !== old.account_id) as boolean;
      const transferChanged = (body.transfer_to_account_id !== undefined &&
        body.transfer_to_account_id !== old.transfer_to_account_id) as boolean;

      if (amountChanged || typeChanged || accountChanged || transferChanged) {
        // Reverse old
        await applyTransactionBalance(
          supabase,
          old.type as string,
          old.account_id as string,
          old.amount as number,
          old.transfer_to_account_id as string | null,
          true,
        );
        // Apply new
        await applyTransactionBalance(
          supabase,
          data.type as string,
          data.account_id as string,
          data.amount as number,
          data.transfer_to_account_id as string | null,
        );
      }
    }

    return jsonResponse(data);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to update transaction');
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams): Promise<Response> {
  try {
    const { id } = await params;
    const { supabase } = await getUserClient();

    // Fetch transaction before deleting to reverse balance
    const { data: tx } = await supabase
      .from('transactions')
      .select('type, amount, account_id, transfer_to_account_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    const { error } = await supabase
      .from('transactions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return errorResponse(error.message, 400);

    // Reverse the balance effect
    if (tx) {
      await applyTransactionBalance(
        supabase,
        tx.type as string,
        tx.account_id as string,
        tx.amount as number,
        tx.transfer_to_account_id as string | null,
        true,
      );
    }

    return jsonResponse({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to delete transaction');
  }
}
