import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';

export async function GET(): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();
    const month = new Date().toISOString().slice(0, 7);

    const [
      usageResult,
      aiLimitResult,
      txLimitResult,
      accountsLimitResult,
      categoriesLimitResult,
      automationsLimitResult,
      accountsCountResult,
      categoriesCountResult,
      automationsCountResult,
    ] = await Promise.all([
      supabase.from('usage_tracking').select('*').eq('month', month).maybeSingle(),
      supabase.from('app_settings').select('value').eq('key', 'free_ai_parses_limit').maybeSingle(),
      supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'free_transactions_limit')
        .maybeSingle(),
      supabase.from('app_settings').select('value').eq('key', 'free_accounts_limit').maybeSingle(),
      supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'free_categories_limit')
        .maybeSingle(),
      supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'free_automations_limit')
        .maybeSingle(),
      supabase
        .from('accounts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true)
        .eq('is_default', false)
        .is('deleted_at', null),
      supabase
        .from('categories')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true)
        .eq('is_default', false)
        .is('deleted_at', null),
      supabase
        .from('automation_rules')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('deleted_at', null),
    ]);

    if (usageResult.error) return errorResponse(usageResult.error.message, 400);

    const usageData = usageResult.data;

    const aiParsesUsed = usageData?.ai_parses_used as number | undefined;
    const txCount = usageData?.transactions_count as number | undefined;
    const aiLimitVal = aiLimitResult.data?.value as number | undefined;
    const txLimitVal = txLimitResult.data?.value as number | undefined;
    const accountsLimitVal = accountsLimitResult.data?.value as number | undefined;
    const categoriesLimitVal = categoriesLimitResult.data?.value as number | undefined;
    const automationsLimitVal = automationsLimitResult.data?.value as number | undefined;

    return jsonResponse({
      month,
      ai_parses_used: aiParsesUsed ?? 0,
      ai_parses_limit: aiLimitVal ?? 15,
      transactions_count: txCount ?? 0,
      transactions_limit: txLimitVal ?? 50,
      accounts_count: accountsCountResult.count ?? 0,
      accounts_limit: accountsLimitVal ?? 4,
      categories_count: categoriesCountResult.count ?? 0,
      categories_limit: categoriesLimitVal ?? 10,
      automations_count: automationsCountResult.count ?? 0,
      automations_limit: automationsLimitVal ?? 10,
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to fetch usage');
  }
}
