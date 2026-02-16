import type { NextRequest } from 'next/server';
import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';

interface UserSettingsRow {
  user_id: string;
  hour_format: string | null;
  show_api_keys: boolean | null;
}

const DEFAULTS = {
  hour_format: '12h',
  show_api_keys: false,
};

export async function GET(): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();

    const { data, error } = await supabase
      .from('user_settings')
      .select('user_id, hour_format, show_api_keys')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return errorResponse(error.message, 400);
    }

    if (!data) {
      return jsonResponse({ user_id: userId, ...DEFAULTS });
    }

    const row = data as UserSettingsRow;
    return jsonResponse({
      user_id: row.user_id,
      hour_format: row.hour_format ?? DEFAULTS.hour_format,
      show_api_keys: row.show_api_keys ?? DEFAULTS.show_api_keys,
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to fetch user settings');
  }
}

export async function PATCH(request: NextRequest): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();
    const body = (await request.json()) as Partial<{
      hour_format: string;
      show_api_keys: boolean;
    }>;

    const updates: Record<string, unknown> = {};
    if (body.hour_format !== undefined) updates.hour_format = body.hour_format;
    if (body.show_api_keys !== undefined) updates.show_api_keys = body.show_api_keys;

    if (Object.keys(updates).length === 0) {
      return errorResponse('No valid fields to update', 400);
    }

    const { data, error } = await supabase
      .from('user_settings')
      .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' })
      .select('user_id, hour_format, show_api_keys')
      .single();

    if (error) return errorResponse(error.message, 400);

    const row = data as UserSettingsRow;
    return jsonResponse({
      user_id: row.user_id,
      hour_format: row.hour_format ?? DEFAULTS.hour_format,
      show_api_keys: row.show_api_keys ?? DEFAULTS.show_api_keys,
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to update user settings');
  }
}
