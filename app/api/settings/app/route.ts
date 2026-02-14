import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';

export async function GET(): Promise<Response> {
  try {
    const { supabase } = await getUserClient();

    const { data, error } = await supabase.from('app_settings').select('key, value');

    if (error) return errorResponse(error.message, 400);

    // Transform array into key-value object
    const settings: Record<string, unknown> = {};
    for (const row of data as Array<{ key: string; value: unknown }>) {
      settings[row.key] = row.value;
    }

    return jsonResponse(settings);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to fetch app settings');
  }
}
