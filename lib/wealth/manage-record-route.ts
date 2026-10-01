import { z } from 'zod';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';

export type WealthKind = 'investment' | 'loan';
type Action = 'rename' | 'archive' | 'restore' | 'delete_empty';

const updateSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('rename'), label: z.string().trim().min(1).max(100) }),
  z.strictObject({ action: z.literal('archive') }),
  z.strictObject({ action: z.literal('restore') }),
]);

async function runAction(
  kind: WealthKind,
  id: string,
  action: Action,
  label: string | null,
): Promise<Response> {
  if (!z.uuid().safeParse(id).success) return errorResponse('Invalid record ID', 400);
  try {
    const { supabase } = await getUserClient();
    const { data, error } = await supabase.rpc('manage_manual_wealth_record', {
      p_kind: kind,
      p_id: id,
      p_action: action,
      p_label: label,
    });
    if (error) {
      if (error.code === 'P0002') return errorResponse('Record not found', 404);
      if (error.code === '23514') return errorResponse(error.message, 409);
      if (error.code === '22023') return errorResponse(error.message, 400);
      return errorResponse('Could not update record');
    }
    return Response.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Could not update record');
  }
}

export async function updateWealthRecord(
  kind: WealthKind,
  request: Request,
  id: string,
): Promise<Response> {
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse('Invalid record action', 400);
  return runAction(
    kind,
    id,
    parsed.data.action,
    parsed.data.action === 'rename' ? parsed.data.label : null,
  );
}

export async function deleteEmptyWealthRecord(kind: WealthKind, id: string): Promise<Response> {
  return runAction(kind, id, 'delete_empty', null);
}
