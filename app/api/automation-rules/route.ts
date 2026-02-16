import type { NextRequest } from 'next/server';
import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { supabase } = await getUserClient();
    const searchParams = request.nextUrl.searchParams;

    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = parseInt(searchParams.get('limit') ?? '20', 10);
    const ruleType = searchParams.get('rule_type');
    const isActive = searchParams.get('is_active');

    let query = supabase.from('automation_rules').select('*', { count: 'exact' });

    if (ruleType) {
      query = query.eq('rule_type', ruleType);
    }

    if (isActive !== null && isActive !== '') {
      query = query.eq('is_active', isActive === 'true');
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await query
      .order('priority', { ascending: false })
      .range(from, to);

    if (error) return errorResponse(error.message, 400);
    return jsonResponse({ data, count: count ?? 0, page });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to fetch automation rules');
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();
    const body = (await request.json()) as Record<string, unknown>;

    // Check automation rule limit for free plan
    const [{ data: subscription }, automationCountResult, { data: limitSetting }] =
      await Promise.all([
        supabase.from('subscriptions').select('plan').eq('user_id', userId).maybeSingle(),
        supabase
          .from('automation_rules')
          .select('id', { count: 'exact', head: true })
          .is('deleted_at', null),
        supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'free_automations_limit')
          .maybeSingle(),
      ]);

    const plan = (subscription?.plan as string | undefined) ?? 'free';
    if (plan === 'free') {
      const limit = (limitSetting?.value as number | undefined) ?? 10;
      const currentCount = automationCountResult.count ?? 0;
      const newCount = Array.isArray(body) ? body.length : 1;
      if (currentCount + newCount > limit) {
        return errorResponse(`Automation rule limit reached (${limit} for free plan)`, 403);
      }
    }

    // Support bulk creation (array of rules)
    if (Array.isArray(body)) {
      const rulesWithUser = body.map((rule) => ({
        ...(rule as Record<string, unknown>),
        user_id: userId,
      }));

      const { data, error } = await supabase
        .from('automation_rules')
        .insert(rulesWithUser)
        .select();

      if (error) return errorResponse(error.message, 400);
      return jsonResponse(data, 201);
    }

    const { data, error } = await supabase
      .from('automation_rules')
      .insert({ ...body, user_id: userId })
      .select()
      .single();

    if (error) return errorResponse(error.message, 400);
    return jsonResponse(data, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to create automation rule');
  }
}
