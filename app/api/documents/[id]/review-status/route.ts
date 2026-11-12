import { z } from 'zod';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
import { hasSameRequestOrigin } from '@/lib/api/request-origin';
const schema = z.strictObject({ status: z.enum(['active', 'completed', 'no_movements']) });
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { supabase, accessToken } = await getUserClient(request);
    if (!accessToken && !hasSameRequestOrigin(request))
      return errorResponse('Invalid request origin', 403);
    const { id } = await params;
    const body = schema.safeParse(await request.json().catch(() => null));
    if (!z.uuid().safeParse(id).success || !body.success)
      return errorResponse('Invalid review status', 400);
    const { error } = await supabase.rpc('set_document_review_status', {
      p_document: id,
      p_status: body.data.status,
    });
    if (error) return errorResponse('Document review changed; refresh before updating', 409);
    return Response.json({ updated: true });
  } catch (error) {
    return errorResponse(
      error instanceof AuthError
        ? error.status === 403
          ? 'Invalid request origin'
          : 'Unauthorized'
        : 'Document review unavailable',
      error instanceof AuthError ? (error.status === 403 ? 403 : 401) : 503,
    );
  }
}
