import { z } from 'zod';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
import { planningCommand } from '@/lib/planning';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: Request): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient(request);
    const [goals, schedules, common, preferences] = await Promise.all([
      supabase
        .from('savings_goals')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('name')
        .limit(201),
      supabase
        .from('planned_expenses')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('next_due')
        .limit(201),
      supabase
        .from('common_expenses')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('name')
        .limit(201),
      supabase.from('product_preferences').select('payload').eq('user_id', userId).maybeSingle(),
    ]);
    if (goals.error || schedules.error || common.error || preferences.error)
      throw new Error('Planning unavailable');
    if ([goals, schedules, common].some((r) => r.data.length > 200))
      return errorResponse('Planning catalog exceeds review limit', 422);
    return Response.json(
      {
        goals: goals.data,
        schedules: schedules.data,
        common: common.data,
        preferences: (preferences.data as { payload: unknown } | null)?.payload ?? {},
      },
      { headers },
    );
  } catch (error) {
    return errorResponse(
      error instanceof AuthError ? 'Unauthorized' : 'Planning unavailable',
      error instanceof AuthError ? 401 : error instanceof SyntaxError ? 400 : 500,
    );
  }
}
export async function POST(request: Request): Promise<Response> {
  try {
    const { supabase } = await getUserClient(request);
    const text = await request.text();
    if (text.length > 8192) return errorResponse('Planning request too large', 413);
    const input = z
      .object({ request_id: z.uuid(), payload: planningCommand })
      .strict()
      .safeParse(JSON.parse(text) as unknown);
    if (!input.success) return errorResponse('Invalid planning request', 400);
    const result = await supabase.rpc('apply_planning_command', {
      p_request_id: input.data.request_id,
      p_payload: input.data.payload,
    });
    if (result.error)
      return errorResponse(
        'Could not save planning. Check the account, dates and amount.',
        result.error.code === '42501' ? 403 : 400,
      );
    return Response.json(result.data, { headers });
  } catch (error) {
    return errorResponse(
      error instanceof AuthError
        ? error.status === 403
          ? 'Invalid request origin'
          : 'Unauthorized'
        : 'Could not save planning',
      error instanceof AuthError
        ? error.status === 403
          ? 403
          : 401
        : error instanceof SyntaxError
          ? 400
          : 500,
    );
  }
}
