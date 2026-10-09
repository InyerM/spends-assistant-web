import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
const schema = z
  .object({
    bank_name: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[\p{L}\p{N}][\p{L}\p{N} .&()'-]*$/u),
  })
  .strict();
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { supabase } = await getUserClient();
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) return errorResponse('Invalid inbox item ID', 400);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON', 400);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return errorResponse('Invalid sender confirmation', 400);
    const { data, error } = await supabase.rpc('confirm_email_sender', {
      p_inbox_item_id: id,
      p_bank_name: parsed.data.bank_name,
    });
    if (error?.code === 'P0002') return errorResponse('Email not found', 404);
    if (error?.code === '22023') return errorResponse('Invalid sender confirmation', 400);
    if (error) return errorResponse('Sender confirmation failed');
    return Response.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Sender confirmation failed');
  }
}
