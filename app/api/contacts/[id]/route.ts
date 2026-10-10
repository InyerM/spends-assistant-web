import { z } from 'zod';
import { AuthError, getUserClient, errorResponse } from '@/lib/api/server';
interface Context {
  params: Promise<{ id: string }>;
}
export async function GET(request: Request, context: Context): Promise<Response> {
  try {
    const { supabase } = await getUserClient(request);
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) return errorResponse('Invalid contact', 400);
    const { data, error } = await supabase.rpc('counterparty_detail', { p_contact: id });
    if (error) return errorResponse('Contact unavailable');
    if (!data) return errorResponse('Contact not found', 404);
    return Response.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return errorResponse(
      error instanceof AuthError ? 'Unauthorized' : 'Contact unavailable',
      error instanceof AuthError ? 401 : 500,
    );
  }
}
export async function PATCH(request: Request, context: Context): Promise<Response> {
  try {
    const { supabase, accessToken } = await getUserClient(request);
    const { id } = await context.params;
    if (!accessToken && request.headers.get('Origin') !== new URL(request.url).origin)
      return errorResponse('Invalid request origin', 403);
    if (!z.uuid().safeParse(id).success) return errorResponse('Invalid contact', 400);
    const text = await request.text();
    if (text.length > 2048) return errorResponse('Request too large', 413);
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      return errorResponse('Invalid contact name', 400);
    }
    const parsed = z
      .object({ name: z.string().trim().min(1).max(100) })
      .strict()
      .safeParse(value);
    if (!parsed.success) return errorResponse('Invalid contact name', 400);
    const { error } = await supabase.rpc('rename_counterparty', {
      p_contact: id,
      p_name: parsed.data.name,
    });
    if (error) return errorResponse('Contact update failed', error.code === '42501' ? 404 : 500);
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return errorResponse(
      error instanceof AuthError ? 'Unauthorized' : 'Contact update failed',
      error instanceof AuthError ? 401 : 500,
    );
  }
}
