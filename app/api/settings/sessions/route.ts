import type { NextRequest } from 'next/server';
import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { supabase } = await getUserClient(request);

    const { data, error } = await supabase
      .from('user_sessions')
      .select('id, device_type, device_name, ip_address, last_active_at')
      .order('last_active_at', { ascending: false });

    if (error) return errorResponse(error.message, 400);
    return jsonResponse(data);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to fetch sessions');
  }
}

export async function DELETE(request: NextRequest): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient(request);
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) return errorResponse('Session ID is required', 400);

    const { error } = await supabase
      .from('user_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) return errorResponse(error.message, 400);
    return jsonResponse({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to revoke session');
  }
}
