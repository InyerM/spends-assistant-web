import type { NextRequest } from 'next/server';
import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';
import { resolveImportReferences } from '@/lib/api/import';
import {
  buildImportInsertRow,
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
  request_id?: unknown;
  transactions?: unknown;
  duplicate_reviews?: unknown;
  file_name?: string;
  row_count?: number;
  force?: unknown;
}

type RpcResult =
  | { status: 'review_required'; duplicates: unknown[]; unreviewed: number[]; stale: number[] }
  | {
      status: 'completed';
      imported: number;
      skipped: number;
      import_id: string;
      replayed?: boolean;
    };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** The RPC owns the duplicate check and every write in one database transaction. */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();
    const body = (await request.json()) as ImportBody;
    const invalid = validateImportRows(body.transactions);
    if (invalid) return errorResponse(invalid, 400);
    if (typeof body.request_id !== 'string' || !UUID.test(body.request_id)) {
      return errorResponse('request_id must be a UUID', 400);
    }
    if (body.force !== undefined && body.force !== false) {
      return errorResponse(
        'force is not supported; send duplicate_reviews for each flagged row',
        400,
      );
    }
    const transactions = body.transactions as ImportTransaction[];
    const parsed = parseDuplicateReviews(body.duplicate_reviews, transactions.length);
    if ('error' in parsed) return errorResponse(parsed.error, 400);

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

    const rows = transactions.map((tx, index) => {
      const row = buildImportInsertRow(tx, {
        userId,
        importId: body.request_id as string,
        accountId: refs.accountIds[index] as string,
        categoryId: refs.categoryIds[index],
        confirmedDuplicate: false,
      });
      delete row.import_id;
      delete row.user_id;
      return row;
    });
    const { data, error } = await supabase.rpc('confirm_csv_import', {
      p_request_id: body.request_id,
      p_rows: rows,
      p_reviews: parsed.reviews,
      p_file_name: body.file_name ?? 'import.csv',
      p_row_count: body.row_count ?? rows.length,
    });
    if (error) {
      if (error.message === 'Transaction limit exceeded') return errorResponse(error.message, 403);
      return errorResponse(`Import failed: ${error.message}`, 500);
    }
    const result = data as RpcResult;
    if (result.status === 'review_required') return jsonResponse(result, 409);
    return jsonResponse(
      {
        imported: result.imported,
        skipped: result.skipped,
        errors:
          refs.unresolvedCategories.length > 0
            ? [`Could not resolve categories: ${refs.unresolvedCategories.join(', ')}`]
            : [],
        import_id: result.import_id,
        replayed: result.replayed ?? false,
      },
      result.replayed ? 200 : 201,
    );
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to import transactions');
  }
}
