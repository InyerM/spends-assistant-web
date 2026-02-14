import type { NextRequest } from 'next/server';
import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';

export async function GET(): Promise<Response> {
  try {
    const { supabase } = await getUserClient();

    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name');

    if (error) return errorResponse(error.message, 400);
    return jsonResponse(data);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to fetch accounts');
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();
    const body = (await request.json()) as Record<string, unknown>;

    // Check account limit for free plan
    const [{ data: subscription }, accountCountResult, { data: limitSetting }] = await Promise.all([
      supabase.from('subscriptions').select('plan').eq('user_id', userId).maybeSingle(),
      supabase
        .from('accounts')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .is('deleted_at', null),
      supabase.from('app_settings').select('value').eq('key', 'free_accounts_limit').maybeSingle(),
    ]);

    const plan = (subscription?.plan as string | undefined) ?? 'free';
    if (plan === 'free') {
      const limit = (limitSetting?.value as number | undefined) ?? 4;
      const count = accountCountResult.count ?? 0;
      if (count >= limit) {
        return errorResponse(`Account limit reached (${limit} for free plan)`, 403);
      }
    }

    const { data, error } = await supabase
      .from('accounts')
      .insert({ ...body, user_id: userId })
      .select()
      .single();

    if (error) return errorResponse(error.message, 400);
    return jsonResponse(data, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to create account');
  }
}
