import type { NextRequest } from 'next/server';
import { getAdminClient, jsonResponse, errorResponse } from '@/lib/api/server';

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const supabase = getAdminClient();
    const body = (await request.json()) as { transactions: Record<string, unknown>[] };

    if (!Array.isArray(body.transactions) || body.transactions.length === 0) {
      return errorResponse('No transactions provided', 400);
    }

    const { data, error } = await supabase.from('transactions').insert(body.transactions).select();

    if (error) return errorResponse(error.message, 400);
    return jsonResponse({ imported: data.length }, 201);
  } catch {
    return errorResponse('Failed to import transactions');
  }
}
