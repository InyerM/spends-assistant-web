import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';

const accountUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    type: z.enum(['checking', 'savings', 'credit_card', 'cash', 'investment', 'crypto', 'credit']),
    institution: z.string().max(100).nullable(),
    last_four: z
      .string()
      .regex(/^\d{4}$/)
      .nullable(),
    color: z.string().max(7).nullable(),
    icon: z.string().max(50).nullable(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0);

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams): Promise<Response> {
  try {
    const { id } = await params;
    const { supabase } = await getUserClient();

    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) return errorResponse(error.message, 404);
    return jsonResponse(data);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to fetch account');
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<Response> {
  try {
    const { id } = await params;
    const { supabase, userId } = await getUserClient();
    const result = accountUpdateSchema.safeParse(await request.json());
    if (!result.success) return errorResponse('Invalid account update', 400);

    const { data, error } = await supabase
      .from('accounts')
      .update(result.data)
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) return errorResponse(error.message, error.code === 'PGRST116' ? 404 : 400);
    return jsonResponse(data);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to update account');
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams): Promise<Response> {
  try {
    const { id } = await params;
    const { supabase } = await getUserClient();
    const { data, error } = await supabase.rpc('soft_delete_empty_account', {
      p_account_id: id,
    });
    if (error) {
      if (error.code === 'P0002') return errorResponse(error.message, 404);
      if (error.message.includes('Default account')) return errorResponse(error.message, 403);
      if (error.message.includes('active transactions')) return errorResponse(error.message, 409);
      return errorResponse(error.message, 400);
    }
    return jsonResponse({ success: true, deleted: data });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to delete account');
  }
}
