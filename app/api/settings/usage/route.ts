import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';

export async function GET(): Promise<Response> {
  try {
    const { supabase } = await getUserClient();
    const month = new Date().toISOString().slice(0, 7);

    const { data, error } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('month', month)
      .maybeSingle();

    if (error) return errorResponse(error.message, 400);

    // Return defaults if no usage record yet
    return jsonResponse(
      data ?? {
        month,
        ai_parses_used: 0,
        ai_parses_limit: 15,
        transactions_count: 0,
        transactions_limit: 50,
      },
    );
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to fetch usage');
  }
}
