import type { NextRequest } from 'next/server';
import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';

export async function GET(): Promise<Response> {
  try {
    const { supabase } = await getUserClient();

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name');

    if (error) return errorResponse(error.message, 400);
    return jsonResponse(data);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to fetch categories');
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();
    const body = (await request.json()) as Record<string, unknown>;

    const { data, error } = await supabase
      .from('categories')
      .insert({ ...body, user_id: userId })
      .select()
      .single();

    if (error) return errorResponse(error.message, 400);
    return jsonResponse(data, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to create category');
  }
}
