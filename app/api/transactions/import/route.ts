import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';
import { findImportDuplicates, resolveImportReferences } from '@/lib/api/import';
import {
  buildImportInsertRow,
  evaluateDuplicateReviews,
  parseDuplicateReviews,
  validateImportRows,
  type ImportRowFields,
} from '@/lib/utils/import-duplicates';

interface ImportTransaction extends ImportRowFields {
  account?: string;
  account_id?: string;
  category?: string | null;
  category_id?: string | null;
}

interface ImportBody {
  transactions?: unknown;
  duplicate_reviews?: unknown;
  file_name?: string;
  row_count?: number;
  force?: unknown;
}

async function checkFreePlanLimit(
  supabase: SupabaseClient,
  userId: string,
  importCount: number,
): Promise<string | null> {
  const [{ data: subscription }, { data: usageData }, { data: limitSetting }] = await Promise.all([
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
  ]);

  const plan = (subscription?.plan as string | undefined) ?? 'free';
  if (plan !== 'free') return null;

  const txLimit = (limitSetting?.value as number | undefined) ?? 50;
  const currentCount = (usageData?.transactions_count as number | undefined) ?? 0;
  if (currentCount + importCount <= txLimit) return null;

  const remaining = Math.max(0, txLimit - currentCount);
  return `Transaction limit exceeded. You have ${remaining} transactions remaining this month (limit: ${txLimit}).`;
}

/**
 * Final CSV import. Duplicate matching is re-run here against the database, so the
 * preview is advisory: every row with an existing match must carry an explicit
 * review listing the match ids the user saw. Replaying a request after its rows were
 * inserted surfaces those rows as new, unreviewed matches and is rejected with 409.
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();
    const body = (await request.json()) as ImportBody;

    const invalid = validateImportRows(body.transactions);
    if (invalid) return errorResponse(invalid, 400);
    const transactions = body.transactions as ImportTransaction[];

    if (body.force !== undefined && body.force !== false) {
      return errorResponse(
        'force is not supported; send duplicate_reviews for each flagged row',
        400,
      );
    }
    const parsedReviews = parseDuplicateReviews(body.duplicate_reviews, transactions.length);
    if ('error' in parsedReviews) return errorResponse(parsedReviews.error, 400);

    const refs = await resolveImportReferences(supabase, transactions);
    if (refs.unresolvedAccounts.length > 0) {
      return jsonResponse(
        {
          error: `Could not resolve accounts: ${refs.unresolvedAccounts.join(', ')}`,
          unresolved_accounts: refs.unresolvedAccounts,
        },
        422,
      );
    }

    const duplicates = await findImportDuplicates(
      supabase,
      transactions.map((tx, i) => ({
        date: tx.date,
        amount: tx.amount,
        account_id: refs.accountIds[i],
      })),
    );
    const review = evaluateDuplicateReviews(duplicates, parsedReviews.reviews);
    if (review.unreviewed.length > 0 || review.stale.length > 0) {
      return jsonResponse(
        {
          error: 'Possible duplicates need review before importing',
          duplicates,
          unreviewed: review.unreviewed,
          stale: review.stale,
        },
        409,
      );
    }

    const errors =
      refs.unresolvedCategories.length > 0
        ? [`Could not resolve categories: ${refs.unresolvedCategories.join(', ')}`]
        : [];
    const toInsert = transactions
      .map((tx, index) => ({ tx, index }))
      .filter(({ index }) => !review.skipIndices.has(index));
    const skipped = transactions.length - toInsert.length;

    if (toInsert.length === 0) {
      return jsonResponse({ imported: 0, skipped, errors, import_id: null }, 200);
    }

    const limitError = await checkFreePlanLimit(supabase, userId, toInsert.length);
    if (limitError) return errorResponse(limitError, 403);

    const { data: importRecord, error: importError } = await supabase
      .from('imports')
      .insert({
        user_id: userId,
        source: 'csv',
        file_name: body.file_name ?? 'import.csv',
        file_path: null,
        row_count: body.row_count ?? transactions.length,
        imported_count: 0,
        status: 'pending',
      })
      .select()
      .single();
    if (importError) return errorResponse(`Failed to create import: ${importError.message}`, 500);

    const importId = importRecord.id as string;
    const rows = toInsert.map(({ tx, index }) =>
      buildImportInsertRow(tx, {
        userId,
        importId,
        accountId: refs.accountIds[index] as string,
        categoryId: refs.categoryIds[index],
        confirmedDuplicate: review.confirmedIndices.has(index),
      }),
    );

    // A single multi-row insert is one statement, so it either writes every row or none.
    const { data, error } = await supabase.from('transactions').insert(rows).select('id');
    if (error) {
      await supabase
        .from('imports')
        .update({ status: 'failed', imported_count: 0 })
        .eq('id', importId);
      return jsonResponse({ error: `Import failed: ${error.message}`, import_id: importId }, 500);
    }

    const imported = (data as { id: string }[] | null)?.length ?? 0;
    const { error: updateError } = await supabase
      .from('imports')
      .update({ status: 'completed', imported_count: imported })
      .eq('id', importId);
    if (updateError) {
      errors.push(`Transactions were imported but the import status could not be updated`);
    }

    return jsonResponse({ imported, skipped, errors, import_id: importId }, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to import transactions');
  }
}
