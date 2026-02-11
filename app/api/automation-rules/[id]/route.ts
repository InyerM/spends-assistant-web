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
      .from('automation_rules')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return errorResponse(error.message, 404);
    return jsonResponse(data);
  } catch {
    return errorResponse('Failed to fetch automation rule');
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<Response> {
  try {
    const { id } = await params;
    const supabase = getAdminClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('automation_rules')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) return errorResponse(error.message, 400);
    return jsonResponse(data);
  } catch {
    return errorResponse('Failed to update automation rule');
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams): Promise<Response> {
  try {
    const { id } = await params;
    const supabase = getAdminClient();

    const { error } = await supabase.from('automation_rules').delete().eq('id', id);

    if (error) return errorResponse(error.message, 400);
    return jsonResponse({ success: true });
  } catch {
    return errorResponse('Failed to delete automation rule');
  }
}
