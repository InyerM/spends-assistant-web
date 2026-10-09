import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';

export async function POST(): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();
    const { error: syncError } = await supabase.rpc('sync_owned_account_detection_rules');
    if (syncError) return errorResponse(syncError.message, 400);
    const { data, error } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('user_id', userId)
      .not('managed_account_id', 'is', null)
      .is('deleted_at', null);
    if (error) return errorResponse(error.message, 400);
    return jsonResponse(
      {
        message: `Synchronized ${data.length} account detection rules`,
        created: data.length,
        data,
      },
      201,
    );
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to synchronize account rules');
  }
}
