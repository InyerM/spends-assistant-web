import type { NextRequest } from 'next/server';
import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { supabase } = await getUserClient();

    const showAll = request.nextUrl.searchParams.get('include_hidden') === 'true';

    let query = supabase.from('categories').select('*').is('deleted_at', null).order('name');

    if (!showAll) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) return errorResponse(error.message, 400);
    return jsonResponse(data);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to fetch categories');
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();
    const body = (await request.json()) as Record<string, unknown>;

    // Check category limit for free plan
    const [{ data: subscription }, categoryCountResult, { data: limitSetting }] = await Promise.all(
      [
        supabase.from('subscriptions').select('plan').eq('user_id', userId).maybeSingle(),
        supabase
          .from('categories')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
          .is('deleted_at', null),
        supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'free_categories_limit')
          .maybeSingle(),
      ],
    );

    const plan = (subscription?.plan as string | undefined) ?? 'free';
    if (plan === 'free') {
      const limit = (limitSetting?.value as number | undefined) ?? 10;
      const count = categoryCountResult.count ?? 0;
      if (count >= limit) {
        return errorResponse(`Category limit reached (${limit} for free plan)`, 403);
      }
    }

    const { data, error } = await supabase
      .from('categories')
      .insert({ ...body, user_id: userId })
      .select()
      .single();

    if (error) return errorResponse(error.message, 400);
    return jsonResponse(data, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to create category');
  }
}
