import type { NextRequest } from 'next/server';
import { getAdminClient, jsonResponse, errorResponse } from '@/lib/api/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams): Promise<Response> {
  try {
    const { id } = await params;
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) return errorResponse(error.message, 404);
    return jsonResponse(data);
  } catch {
    return errorResponse('Failed to fetch account');
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<Response> {
  try {
    const { id } = await params;
    const supabase = getAdminClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('accounts')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) return errorResponse(error.message, 400);
    return jsonResponse(data);
  } catch {
    return errorResponse('Failed to update account');
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams): Promise<Response> {
  try {
    const { id } = await params;
    const supabase = getAdminClient();
    const now = new Date().toISOString();

    const { error: accountError } = await supabase
      .from('accounts')
      .update({ deleted_at: now })
      .eq('id', id);

    if (accountError) return errorResponse(accountError.message, 400);

    const { error: txError } = await supabase
      .from('transactions')
      .update({ deleted_at: now })
      .eq('account_id', id)
      .is('deleted_at', null);

    if (txError) return errorResponse(txError.message, 400);

    return jsonResponse({ success: true });
  } catch {
    return errorResponse('Failed to delete account');
  }
}
