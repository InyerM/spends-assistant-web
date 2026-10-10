import { z } from 'zod';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
export async function GET(request: Request): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient(request);
    const raw = new URL(request.url).searchParams.get('ids')?.split(',') ?? [];
    if (!z.array(z.uuid()).min(1).max(100).safeParse(raw).success)
      return errorResponse('Invalid transaction IDs', 400);
    const result = await supabase
      .from('statement_reconciliation_proofs')
      .select('id,document_id,observation_id,transaction_id,file_name,valid')
      .eq('user_id', userId)
      .in('transaction_id', raw)
      .limit(1000);
    if (result.error) return errorResponse('Could not load statement evidence');
    if (result.data.length >= 1000) return errorResponse('Evidence exceeds review limit', 422);
    return Response.json(
      { data: result.data },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Could not load statement evidence');
  }
}
