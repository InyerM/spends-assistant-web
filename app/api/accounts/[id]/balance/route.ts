import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { AuthError, errorResponse, getUserClient, jsonResponse } from '@/lib/api/server';

const schema = z
  .object({
    request_id: z.uuid(),
    target: z
      .number()
      .min(-9999999999999.99)
      .max(9999999999999.99)
      .refine((value) => Number(value.toFixed(2)) === value),
    mode: z.enum(['manual', 'transaction']),
  })
  .strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { supabase } = await getUserClient(request);
    const { id } = await params;
    const input = schema.safeParse(await request.json());
    if (!z.uuid().safeParse(id).success || !input.success)
      return errorResponse('Invalid balance adjustment', 400);
    const { data, error } = await supabase.rpc('adjust_account_balance', {
      p_request_id: input.data.request_id,
      p_account_id: id,
      p_target: input.data.target,
      p_mode: input.data.mode,
      p_source: 'web',
    });
    if (error)
      return errorResponse(
        error.message,
        error.code === 'P0002'
          ? 404
          : error.code === '42501'
            ? 403
            : error.code === 'P0001'
              ? 429
              : 400,
      );
    return jsonResponse(data);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, 401);
    return errorResponse('Failed to adjust balance');
  }
}
