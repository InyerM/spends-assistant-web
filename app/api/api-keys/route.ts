import type { NextRequest } from 'next/server';
import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';
import { generateApiKey, hashApiKey } from '@/lib/utils/api-key';

export async function GET(): Promise<Response> {
  try {
    const { supabase } = await getUserClient();

    const { data, error } = await supabase
      .from('user_api_keys')
      .select('id, name, is_active, last_used_at, created_at')
      .order('created_at', { ascending: false });

    if (error) return errorResponse(error.message, 400);
    return jsonResponse(data);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to fetch API keys');
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();
    const body = (await request.json()) as { name?: string };
    const name = body.name ?? 'Default';

    const plainKey = generateApiKey();
    const keyHash = await hashApiKey(plainKey);

    const { data, error } = await supabase
      .from('user_api_keys')
      .insert({ user_id: userId, key_hash: keyHash, name })
      .select('id, name, created_at')
      .single();

    if (error) return errorResponse(error.message, 400);

    // Return the plain key ONCE — it cannot be retrieved again
    return jsonResponse({ ...data, key: plainKey }, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to create API key');
  }
}

export async function DELETE(request: NextRequest): Promise<Response> {
  try {
    const { supabase } = await getUserClient();
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) return errorResponse('Key ID is required', 400);

    const { error } = await supabase.from('user_api_keys').delete().eq('id', id);

    if (error) return errorResponse(error.message, 400);
    return jsonResponse({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to delete API key');
  }
}
