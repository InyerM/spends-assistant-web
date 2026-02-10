import type { NextRequest } from 'next/server';
import { getAdminClient, jsonResponse, errorResponse } from '@/lib/api/server';

export async function GET(): Promise<Response> {
  try {
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name');

    if (error) return errorResponse(error.message, 400);
    return jsonResponse(data);
  } catch {
    return errorResponse('Failed to fetch accounts');
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const supabase = getAdminClient();
    const body = await request.json();

    const { data, error } = await supabase.from('accounts').insert(body).select().single();

    if (error) return errorResponse(error.message, 400);
    return jsonResponse(data, 201);
  } catch {
    return errorResponse('Failed to create account');
  }
}
