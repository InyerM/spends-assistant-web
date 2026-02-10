import type { NextRequest } from 'next/server';
import { getAdminClient, jsonResponse, errorResponse } from '@/lib/api/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams): Promise<Response> {
  try {
    const { id } = await params;
    const supabase = getAdminClient();

    const { data, error } = await supabase.from('categories').select('*').eq('id', id).single();

    if (error) return errorResponse(error.message, 404);
    return jsonResponse(data);
  } catch {
    return errorResponse('Failed to fetch category');
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<Response> {
  try {
    const { id } = await params;
    const supabase = getAdminClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('categories')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) return errorResponse(error.message, 400);
    return jsonResponse(data);
  } catch {
    return errorResponse('Failed to update category');
  }
}
