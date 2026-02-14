import type { NextRequest } from 'next/server';
import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';

export async function GET(): Promise<Response> {
  try {
    const { supabase } = await getUserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return errorResponse('Unauthorized', 401);

    return jsonResponse({
      id: user.id,
      email: user.email,
      display_name: (user.user_metadata.display_name as string | undefined) ?? null,
      avatar_url: (user.user_metadata.avatar_url as string | undefined) ?? null,
      providers: (user.app_metadata.providers as string[] | undefined) ?? [],
      created_at: user.created_at,
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to fetch profile');
  }
}

export async function PATCH(request: NextRequest): Promise<Response> {
  try {
    const { supabase } = await getUserClient();
    const body = (await request.json()) as { display_name?: string };

    const { data, error } = await supabase.auth.updateUser({
      data: { display_name: body.display_name },
    });

    if (error) return errorResponse(error.message, 400);

    return jsonResponse({
      id: data.user.id,
      email: data.user.email,
      display_name: (data.user.user_metadata.display_name as string | undefined) ?? null,
      avatar_url: (data.user.user_metadata.avatar_url as string | undefined) ?? null,
      providers: (data.user.app_metadata.providers as string[] | undefined) ?? [],
      created_at: data.user.created_at,
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to update profile');
  }
}
