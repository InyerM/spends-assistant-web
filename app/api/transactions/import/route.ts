import type { NextRequest } from 'next/server';
import { getAdminClient, jsonResponse, errorResponse } from '@/lib/api/server';

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
): Promise<{ resolved: Record<string, unknown>[]; errors: string[] }> {
  const supabase = getAdminClient();
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
    const supabase = getAdminClient();
    const body = (await request.json()) as ImportBody;

    if (!Array.isArray(body.transactions) || body.transactions.length === 0) {
      return errorResponse('No transactions provided', 400);
    }

    if (body.resolve_names) {
      const { resolved, errors } = await resolveNames(body.transactions);

      if (resolved.length === 0) {
        return errorResponse(
          errors.length > 0 ? errors[0] : 'No transactions could be resolved',
          400,
        );
      }

      const { data, error } = await supabase.from('transactions').insert(resolved).select();

      if (error) return errorResponse(error.message, 400);

      const skipped = body.transactions.length - resolved.length;
      return jsonResponse({ imported: data.length, skipped, errors }, 201);
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert(body.transactions as unknown as Record<string, unknown>[])
      .select();

    if (error) return errorResponse(error.message, 400);
    return jsonResponse({ imported: data.length, skipped: 0, errors: [] }, 201);
  } catch {
    return errorResponse('Failed to import transactions');
  }
}
