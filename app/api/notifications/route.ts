import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';

const privateHeaders = { 'Cache-Control': 'private, no-store' };
const readSchema = z.object({ id: z.uuid().optional() }).strict();

const listSchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  unread: z.enum(['true', 'false']).default('false'),
});

export async function GET(request?: NextRequest): Promise<Response> {
  try {
    const { supabase } = await getUserClient();
    const params = request?.nextUrl.searchParams;
    const parsed = listSchema.safeParse({
      page: params?.get('page') ?? undefined,
      limit: params?.get('limit') ?? undefined,
      unread: params?.get('unread') ?? undefined,
    });
    if (!parsed.success) return errorResponse('Invalid notification pagination', 400);
    const { page, limit, unread } = parsed.data;
    const { data, error } = await supabase.rpc('refresh_owner_notifications', {
      p_limit: limit,
      p_offset: (page - 1) * limit,
      p_unread: unread === 'true',
    });
    if (error) return errorResponse('Could not load notifications');
    return Response.json(data, { headers: privateHeaders });
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Could not load notifications');
  }
}

export async function PATCH(request: NextRequest): Promise<Response> {
  try {
    const { supabase } = await getUserClient();
    const input = readSchema.safeParse(await request.json());
    if (!input.success) return errorResponse('Invalid notification', 400);
    const { data, error } = await supabase.rpc('mark_owner_notifications_read', {
      p_id: input.data.id ?? null,
    });
    if (error) return errorResponse('Could not mark notifications read');
    return Response.json({ updated: data }, { headers: privateHeaders });
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Could not mark notifications read');
  }
}
