import type { NextRequest } from 'next/server';
import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';
import { z } from 'zod';
import { accountIdentifiersSchema } from '@/lib/accounts/identifier-schema';

const accountCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    type: z.enum(['checking', 'savings', 'credit_card', 'cash', 'investment', 'crypto', 'credit']),
    institution: z.string().max(100).nullable().optional(),
    last_four: z
      .string()
      .regex(/^\d{4}$/u)
      .nullable()
      .optional(),
    identifiers: accountIdentifiersSchema.optional(),
    currency: z.string().length(3).optional(),
    balance: z.number().optional(),
    color: z.string().max(7).nullable().optional(),
    icon: z.string().max(50).nullable().optional(),
  })
  .strict();

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
    const parsed = accountCreateSchema.safeParse(await request.json());
    if (!parsed.success) return errorResponse('Invalid account', 400);

    // Check account limit for free plan
    const [{ data: subscription }, accountCountResult, { data: limitSetting }] = await Promise.all([
      supabase.from('subscriptions').select('plan, status').eq('user_id', userId).maybeSingle(),
      supabase
        .from('accounts')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('is_default', false)
        .is('deleted_at', null),
      supabase.from('app_settings').select('value').eq('key', 'free_accounts_limit').maybeSingle(),
    ]);

    if (subscription?.plan !== 'pro' || subscription.status !== 'active') {
      const limit = (limitSetting?.value as number | undefined) ?? 4;
      const count = accountCountResult.count ?? 0;
      if (count >= limit) {
        return errorResponse(`Account limit reached (${limit} for free plan)`, 403);
      }
    }

    const { data, error } = await supabase
      .from('accounts')
      .insert({ ...parsed.data, user_id: userId })
      .select()
      .single();

    if (error) return errorResponse(error.message, 400);
    return jsonResponse(data, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to create account');
  }
}
