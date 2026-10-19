import { z } from 'zod';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
export async function GET(request: Request): Promise<Response> {
  try {
    const { supabase } = await getUserClient(request);
    const contact = new URL(request.url).searchParams.get('contact_id');
    if (contact && !z.uuid().safeParse(contact).success)
      return errorResponse('Invalid contact', 400);
    const { data, error } = await supabase.rpc('list_category_suggestions', { p_contact: contact });
    if (error) return errorResponse('Category suggestions unavailable', 400);
    return Response.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return errorResponse(
      error instanceof AuthError ? 'Unauthorized' : 'Category suggestions unavailable',
      error instanceof AuthError ? 401 : 500,
    );
  }
}
