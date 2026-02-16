import type { NextRequest } from 'next/server';
import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';

interface ImportTransaction {
  date: string;
  time: string;
  amount: number;
  description: string;
  notes: string | null;
  type: string;
  account: string;
  account_id?: string;
  category: string | null;
  category_id?: string | null;
  payment_method: string | null;
  source: string;
}

interface ImportBody {
  transactions: ImportTransaction[];
  resolve_names?: boolean;
}

async function resolveNames(
  transactions: ImportTransaction[],
  supabase: Awaited<ReturnType<typeof getUserClient>>['supabase'],
): Promise<{ resolved: Record<string, unknown>[]; errors: string[] }> {
  const errors: string[] = [];

  const { data: accounts } = await supabase.from('accounts').select('id, name');
  const { data: categories } = await supabase.from('categories').select('id, name');

  const accountsByName = new Map<string, string>();
  for (const a of accounts ?? []) {
    accountsByName.set((a.name as string).toLowerCase(), a.id as string);
  }

  const categoriesByName = new Map<string, string>();
  for (const c of categories ?? []) {
    categoriesByName.set((c.name as string).toLowerCase(), c.id as string);
  }

  const resolved: Record<string, unknown>[] = [];
  const unresolvedAccounts = new Set<string>();

  for (const tx of transactions) {
    const accountName = tx.account;
    const categoryName = tx.category;

    const accountId = tx.account_id ?? accountsByName.get(accountName.toLowerCase());
    const categoryId =
      tx.category_id ?? (categoryName ? categoriesByName.get(categoryName.toLowerCase()) : null);

    if (!accountId) {
      unresolvedAccounts.add(accountName);
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { account, category, ...rest } = tx;
    resolved.push({
      ...rest,
      account_id: accountId,
      category_id: categoryId ?? null,
    });
  }

  if (unresolvedAccounts.size > 0) {
    errors.push(`Could not resolve accounts: ${[...unresolvedAccounts].join(', ')}`);
  }

  return { resolved, errors };
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();
    const body = (await request.json()) as ImportBody;

    if (!Array.isArray(body.transactions) || body.transactions.length === 0) {
      return errorResponse('No transactions provided', 400);
    }

    // Check transaction limit for free plan
    const [{ data: subscription }, { data: usageData }, { data: limitSetting }] = await Promise.all(
      [
        supabase.from('subscriptions').select('plan').eq('user_id', userId).maybeSingle(),
        supabase
          .from('usage_tracking')
          .select('transactions_count')
          .eq('month', new Date().toISOString().slice(0, 7))
          .maybeSingle(),
        supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'free_transactions_limit')
          .maybeSingle(),
      ],
    );

    const plan = (subscription?.plan as string | undefined) ?? 'free';
    if (plan === 'free') {
      const txLimit = (limitSetting?.value as number | undefined) ?? 50;
      const txCountVal = usageData?.transactions_count as number | undefined;
      const currentCount = txCountVal ?? 0;
      const importCount = body.transactions.length;
      if (currentCount + importCount > txLimit) {
        const remaining = Math.max(0, txLimit - currentCount);
        return errorResponse(
          `Transaction limit exceeded. You have ${remaining} transactions remaining this month (limit: ${txLimit}).`,
          403,
        );
      }
    }

    if (body.resolve_names) {
      const { resolved, errors } = await resolveNames(body.transactions, supabase);

      if (resolved.length === 0) {
        return errorResponse(
          errors.length > 0 ? errors[0] : 'No transactions could be resolved',
          400,
        );
      }

      // Add user_id to each resolved transaction
      const withUserId = resolved.map((tx) => ({ ...tx, user_id: userId }));

      const { data, error } = await supabase.from('transactions').insert(withUserId).select();

      if (error) return errorResponse(error.message, 400);

      const skipped = body.transactions.length - resolved.length;
      return jsonResponse({ imported: data.length, skipped, errors }, 201);
    }

    // Add user_id to each transaction
    const withUserId = (body.transactions as unknown as Record<string, unknown>[]).map((tx) => ({
      ...tx,
      user_id: userId,
    }));

    const { data, error } = await supabase.from('transactions').insert(withUserId).select();

    if (error) return errorResponse(error.message, 400);
    return jsonResponse({ imported: data.length, skipped: 0, errors: [] }, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to import transactions');
  }
}
