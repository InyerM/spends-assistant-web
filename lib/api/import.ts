import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildDuplicateOrFilter,
  groupDuplicateCandidates,
  mapMatchesToDuplicates,
} from '@/lib/utils/import-duplicates';
import type { DuplicateCandidateRow, ImportDuplicate, ImportDuplicateMatch } from '@/types/import';

const DUPLICATE_QUERY_CHUNK_SIZE = 50;

export interface ImportReferenceRow {
  account?: string | null;
  account_id?: string | null;
  category?: string | null;
  category_id?: string | null;
  type?: string | null;
}

export interface ResolvedImportReferences {
  accountIds: (string | null)[];
  categoryIds: (string | null)[];
  unresolvedAccounts: string[];
  unresolvedCategories: string[];
}

function indexByLowerName(rows: { id: unknown; name: unknown }[] | null): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of rows ?? []) map.set((r.name as string).toLowerCase(), r.id as string);
  return map;
}

/**
 * Resolves account/category ids from ids or names. Client-supplied ids are only
 * accepted when they belong to the caller's own accounts/categories.
 */
export async function resolveImportReferences(
  supabase: SupabaseClient,
  rows: ImportReferenceRow[],
): Promise<ResolvedImportReferences> {
  const [{ data: accounts, error: accountsError }, { data: categories, error: categoriesError }] =
    await Promise.all([
      supabase.from('accounts').select('id, name').is('deleted_at', null),
      supabase.from('categories').select('id, name, type'),
    ]);
  if (accountsError) throw new Error(accountsError.message);
  if (categoriesError) throw new Error(categoriesError.message);

  const accountsByName = indexByLowerName(accounts);
  const categoryRows = categories as { id: string; name: string; type: string }[];
  const categoriesByNameAndType = new Map(
    categoryRows.map((category) => [
      `${category.type}:${category.name.toLowerCase()}`,
      category.id,
    ]),
  );
  const accountIds = new Set(accountsByName.values());
  const categoriesById = new Map(categoryRows.map((category) => [category.id, category]));
  const unresolvedAccounts = new Set<string>();
  const unresolvedCategories = new Set<string>();

  const resolved: ResolvedImportReferences = {
    accountIds: [],
    categoryIds: [],
    unresolvedAccounts: [],
    unresolvedCategories: [],
  };

  for (const row of rows) {
    const accountId = row.account_id
      ? accountIds.has(row.account_id)
        ? row.account_id
        : null
      : (accountsByName.get((row.account ?? '').toLowerCase()) ?? null);
    if (!accountId) unresolvedAccounts.add(row.account_id ?? row.account ?? '');
    resolved.accountIds.push(accountId);

    let categoryId: string | null = null;
    const transactionType = row.type ?? 'expense';
    if (row.category_id && categoriesById.get(row.category_id)?.type === transactionType) {
      categoryId = row.category_id;
    } else if (row.category) {
      categoryId =
        categoriesByNameAndType.get(`${transactionType}:${row.category.toLowerCase()}`) ?? null;
    }
    if (!categoryId && (row.category_id || row.category)) {
      unresolvedCategories.add(row.category ?? row.category_id ?? '');
    }
    resolved.categoryIds.push(categoryId);
  }

  resolved.unresolvedAccounts = [...unresolvedAccounts];
  resolved.unresolvedCategories = [...unresolvedCategories];
  return resolved;
}

/**
 * Finds non-deleted transactions sharing date, amount and account with each row.
 * Throws on query errors so callers fail closed instead of treating them as "no matches".
 */
export async function findImportDuplicates(
  supabase: SupabaseClient,
  rows: DuplicateCandidateRow[],
): Promise<ImportDuplicate[]> {
  const groups = groupDuplicateCandidates(rows);
  const chunks = [];
  for (let c = 0; c < groups.length; c += DUPLICATE_QUERY_CHUNK_SIZE) {
    chunks.push(groups.slice(c, c + DUPLICATE_QUERY_CHUNK_SIZE));
  }

  const results = await Promise.all(
    chunks.map((chunk) =>
      supabase
        .from('transactions')
        .select('id, date, amount, description, account_id')
        .is('deleted_at', null)
        .or(buildDuplicateOrFilter(chunk)),
    ),
  );

  const matches: ImportDuplicateMatch[] = [];
  for (const { data, error } of results) {
    if (error) throw new Error(error.message);
    matches.push(...((data as ImportDuplicateMatch[] | null) ?? []));
  }
  return mapMatchesToDuplicates(groups, matches);
}
