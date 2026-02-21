import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';

export async function GET(): Promise<Response> {
  try {
    const { supabase } = await getUserClient();

    const { data, error } = await supabase
      .from('subscriptions')
      .select('plan, status, current_period_start, current_period_end')
      .single();

    if (error) {
      // No subscription found — return free defaults
      if (error.code === 'PGRST116') {
        return jsonResponse({
          plan: 'free',
          status: 'active',
          current_period_start: null,
          current_period_end: null,
        });
      }
      return errorResponse(error.message, 400);
    }

    return jsonResponse(data);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to fetch subscription');
  }
}
