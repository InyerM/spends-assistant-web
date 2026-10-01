import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const patchSchema = z
  .strictObject({
    date: z.iso.date().optional(),
    time: z
      .string()
      .regex(/^[0-9]{2}:[0-9]{2}(:[0-9]{2})?$/)
      .optional(),
    amount: z.number().positive().optional(),
    description: z.string().trim().min(1).optional(),
    notes: z.string().nullable().optional(),
    category_id: z.uuid().nullable().optional(),
    account_id: z.uuid().optional(),
    type: z.enum(['expense', 'income', 'transfer']).optional(),
    payment_method: z.string().max(50).nullable().optional(),
    transfer_to_account_id: z.uuid().nullable().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0);

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
    if (!z.uuid().safeParse(id).success) return errorResponse('Invalid transaction ID', 400);
    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse('Invalid transaction patch fields', 400);
    const { data, error } = await supabase.rpc('patch_reviewed_transaction', {
      p_transaction_id: id,
      p_patch: parsed.data,
    });
    if (error) {
      if (error.code === 'P0002') return errorResponse('Transaction not found', 404);
      if (error.code === '23514') return errorResponse(error.message, 409);
      if (error.code === '42501' || error.code.startsWith('22')) {
        return errorResponse(error.message, 400);
      }
      return errorResponse('Failed to update transaction');
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
    const { error } = await supabase.rpc('soft_delete_transactions', {
      p_transaction_ids: [id],
    });
    if (error) {
      const conflict =
        error.message === 'Reviewed transaction cannot be deleted' ||
        error.message === 'Transaction has a reviewed wealth link' ||
        error.message === 'Transaction accounts changed during deletion';
      return errorResponse(error.message, conflict ? 409 : 400);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to delete transaction');
  }
}
