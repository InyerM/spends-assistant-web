import { z } from 'zod';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
const privateHeaders = { 'Cache-Control': 'private, no-store' };
const deleteSchema = z.object({ id: z.uuid() });

export async function GET(request: Request): Promise<Response> {
  const page = z.coerce
    .number()
    .int()
    .min(0)
    .max(1000)
    .safeParse(new URL(request.url).searchParams.get('page') ?? 0);
  if (!page.success) return errorResponse('Invalid history page', 400);
  try {
    const { supabase, userId } = await getUserClient(request);
    const { data, error } = await supabase
      .from('financial_chat_history')
      .select('id,month,question,answer,insufficient_context,citation_ids,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('id')
      .range(page.data * 25, page.data * 25 + 25);
    if (error) return errorResponse('Could not load chat history', 503);
    return Response.json(
      { data: data.slice(0, 25), hasMore: data.length > 25 },
      { headers: privateHeaders },
    );
  } catch (error) {
    return errorResponse('Could not load chat history', error instanceof AuthError ? 401 : 503);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const { supabase, userId, accessToken } = await getUserClient(request);
    if (!accessToken && request.headers.get('Origin') !== new URL(request.url).origin)
      return errorResponse('Invalid request origin', 403);
    const body = deleteSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return errorResponse('Invalid history entry', 400);
    const { data, error } = await supabase
      .from('financial_chat_history')
      .delete()
      .eq('user_id', userId)
      .eq('id', body.data.id)
      .select('id');
    if (error) return errorResponse('Could not delete chat', 503);
    if (!data.length) return errorResponse('Chat not found', 404);
    return Response.json({ deleted: true }, { headers: privateHeaders });
  } catch (error) {
    return errorResponse('Could not delete chat', error instanceof AuthError ? 401 : 503);
  }
}
