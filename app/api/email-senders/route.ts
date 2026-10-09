import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
export async function GET(): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();
    const { data, error } = await supabase
      .from('email_sender_confirmations')
      .select('sender_address,bank_name,confirmed_at')
      .eq('user_id', userId);
    if (error) return errorResponse('Sender confirmations unavailable');
    return Response.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Sender confirmations unavailable');
  }
}
