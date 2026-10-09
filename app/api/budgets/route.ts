import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';

const privateHeaders = { 'Cache-Control': 'private, no-store' };
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/);
const upsertSchema = z.object({
  month: monthSchema,
  category_id: z.uuid(),
  repeat_monthly: z.boolean().default(false),
  limit_cop: z
    .number()
    .positive()
    .max(9_999_999_999_999.99)
    .refine((value) => Math.abs(Math.round(value * 100) / 100 - value) < 1e-9),
});
const deactivateSchema = z.object({ budget_id: z.uuid(), month: monthSchema.optional() });

function rpcError(error: { code?: string; message: string }): Response {
  if (error.code === '42501' && error.message === 'Terms acceptance required')
    return errorResponse(error.message, 403);
  if (error.code === '23505')
    return errorResponse('A budget already exists for this category and month', 409);
  if (error.code === 'P0002') return errorResponse('Budget not found', 404);
  if (error.code === '42501') return errorResponse('Budget category not found', 404);
  if (['22023', '23514', '23503'].includes(error.code ?? '')) {
    return errorResponse(error.message, 400);
  }
  return errorResponse('Could not update budget');
}

export async function GET(request: NextRequest): Promise<Response> {
  const month = monthSchema.safeParse(request.nextUrl.searchParams.get('month'));
  if (!month.success) return errorResponse('A valid month is required', 400);

  try {
    const { supabase } = await getUserClient();
    const { data, error } = await supabase.rpc('get_monthly_budget_status', {
      p_month: month.data,
    });
    if (error) return rpcError(error);
    return Response.json({ data: data ?? [] }, { headers: privateHeaders });
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Could not load budgets');
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const parsed = upsertSchema.safeParse(await request.json());
    if (!parsed.success) return errorResponse('A valid COP budget is required', 400);

    const { supabase } = await getUserClient();
    const { data, error } = await supabase.rpc('create_monthly_budget', {
      p_month: parsed.data.month,
      p_category_id: parsed.data.category_id,
      p_limit_cop: parsed.data.limit_cop,
      p_repeat_monthly: parsed.data.repeat_monthly,
    });
    if (error) return rpcError(error);
    return Response.json({ id: data }, { headers: privateHeaders });
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Could not save budget');
  }
}

export async function DELETE(request: NextRequest): Promise<Response> {
  try {
    const parsed = deactivateSchema.safeParse(await request.json());
    if (!parsed.success) return errorResponse('A valid budget is required', 400);

    const { supabase } = await getUserClient();
    const { data, error } = await supabase.rpc(
      parsed.data.month ? 'stop_monthly_budget' : 'deactivate_monthly_budget',
      {
        p_budget_id: parsed.data.budget_id,
        ...(parsed.data.month ? { p_month: parsed.data.month } : {}),
      },
    );
    if (error) return rpcError(error);
    if (!data) return errorResponse('Budget not found', 404);
    return Response.json({ deactivated: true }, { headers: privateHeaders });
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Could not deactivate budget');
  }
}

export async function PATCH(request: NextRequest): Promise<Response> {
  try {
    const parsed = upsertSchema.extend({ budget_id: z.uuid() }).safeParse(await request.json());
    if (!parsed.success) return errorResponse('A valid COP budget is required', 400);
    const { supabase } = await getUserClient();
    const { data, error } = await supabase.rpc('update_monthly_budget', {
      p_budget_id: parsed.data.budget_id,
      p_month: parsed.data.month,
      p_category_id: parsed.data.category_id,
      p_limit_cop: parsed.data.limit_cop,
      p_repeat_monthly: parsed.data.repeat_monthly,
    });
    if (error) return rpcError(error);
    return Response.json({ id: data }, { headers: privateHeaders });
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Could not save budget');
  }
}
