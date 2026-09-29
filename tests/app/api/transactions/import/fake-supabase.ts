import { vi } from 'vitest';

type Op = [string, unknown[]];

export interface FakeRow {
  id: string;
  date: string;
  amount: number;
  description: string;
  account_id: string;
  [key: string]: unknown;
}

export interface FakeDbOptions {
  accounts?: { id: string; name: string }[];
  categories?: { id: string; name: string }[];
  transactions?: FakeRow[];
  failTransactionInsert?: string;
  failTransactionSelect?: string;
  failImportInsert?: string;
  failImportUpdate?: string;
  plan?: string;
  transactionsCount?: number;
}

/** Minimal PostgREST-like fake: enough to exercise the import routes end to end. */
export function createFakeSupabase(options: FakeDbOptions = {}) {
  const state = {
    transactions: [...(options.transactions ?? [])],
    imports: [] as Record<string, unknown>[],
    transactionInserts: [] as Record<string, unknown>[][],
    importUpdates: [] as Record<string, unknown>[],
  };
  let seq = 0;
  const requestHashes = new Map<string, string>();

  const rpc = vi.fn(async (_name: string, args: Record<string, unknown>) => {
    const rows = args.p_rows as FakeRow[];
    const reviews = args.p_reviews as { index: number; match_ids: string[]; decision: string }[];
    const requestId = args.p_request_id as string;
    const hash = JSON.stringify({ rows, reviews, file: args.p_file_name, count: args.p_row_count });
    const previous = requestHashes.get(requestId);
    if (previous) {
      if (previous !== hash)
        return {
          data: null,
          error: { message: 'request_id already belongs to a different payload' },
        };
      const record = state.imports.find((item) => item.request_id === requestId)!;
      return {
        data: {
          status: 'completed',
          imported: record.imported_count,
          skipped: record.skipped_count,
          import_id: record.id,
          replayed: true,
        },
        error: null,
      };
    }
    if (options.failTransactionSelect)
      return { data: null, error: { message: options.failTransactionSelect } };
    const duplicates: { index: number; match: FakeRow }[] = [];
    const unreviewed: number[] = [];
    const stale: number[] = [];
    rows.forEach((row, index) => {
      const matches = state.transactions.filter(
        (tx) =>
          tx.date === row.date &&
          Number(tx.amount) === Number(row.amount) &&
          tx.account_id === row.account_id,
      );
      duplicates.push(...matches.map((match) => ({ index, match })));
      const review = reviews.find((item) => item.index === index);
      if (matches.length && !review) unreviewed.push(index);
      else if (matches.some((match) => !review?.match_ids.includes(match.id))) stale.push(index);
    });
    if (unreviewed.length || stale.length)
      return { data: { status: 'review_required', duplicates, unreviewed, stale }, error: null };
    const toInsert = rows.filter(
      (_, index) => reviews.find((review) => review.index === index)?.decision !== 'skip',
    );
    const skipped = rows.length - toInsert.length;
    if (
      (options.plan ?? 'pro') === 'free' &&
      (options.transactionsCount ?? 0) + toInsert.length > 50
    ) {
      return { data: null, error: { message: 'Transaction limit exceeded' } };
    }
    if (options.failImportInsert || options.failTransactionInsert || options.failImportUpdate) {
      return {
        data: null,
        error: {
          message:
            options.failImportInsert ?? options.failTransactionInsert ?? options.failImportUpdate,
        },
      };
    }
    const importId = `import-${++seq}`;
    const created = toInsert.map((row) => ({
      ...row,
      id: `tx-new-${++seq}`,
      user_id: 'test-user-id',
      import_id: importId,
      ...(reviews.find((review) => review.index === rows.indexOf(row))?.decision === 'import'
        ? { duplicate_status: 'confirmed' }
        : {}),
    }));
    state.transactionInserts.push(created);
    state.transactions.push(...created);
    state.imports.push({
      id: importId,
      request_id: requestId,
      status: 'completed',
      imported_count: created.length,
      skipped_count: skipped,
    });
    requestHashes.set(requestId, hash);
    return {
      data: {
        status: 'completed',
        imported: created.length,
        skipped,
        import_id: importId,
        replayed: false,
      },
      error: null,
    };
  });

  const matchesOrFilter = (row: FakeRow, filter: string): boolean => {
    const groups = [
      ...filter.matchAll(/and\(date\.eq\.([^,]+),amount\.eq\.([^,]+),account_id\.eq\.([^)]+)\)/g),
    ];
    return groups.some(
      ([, date, amount, accountId]) =>
        row.date === date && Number(row.amount) === Number(amount) && row.account_id === accountId,
    );
  };

  const resolve = (table: string, ops: Op[]): { data: unknown; error: unknown } => {
    const has = (name: string): Op | undefined => ops.find(([m]) => m === name);
    const insert = has('insert');
    const update = has('update');

    if (table === 'accounts') return { data: options.accounts ?? [], error: null };
    if (table === 'categories') return { data: options.categories ?? [], error: null };
    if (table === 'subscriptions') return { data: { plan: options.plan ?? 'pro' }, error: null };
    if (table === 'app_settings') return { data: { value: 50 }, error: null };
    if (table === 'usage_tracking') {
      return { data: { transactions_count: options.transactionsCount ?? 0 }, error: null };
    }

    if (table === 'imports') {
      if (insert) {
        if (options.failImportInsert)
          return { data: null, error: { message: options.failImportInsert } };
        const record = { id: `import-${++seq}`, ...(insert[1][0] as Record<string, unknown>) };
        state.imports.push(record);
        return { data: record, error: null };
      }
      if (update) {
        state.importUpdates.push(update[1][0] as Record<string, unknown>);
        if (options.failImportUpdate)
          return { data: null, error: { message: options.failImportUpdate } };
        return { data: null, error: null };
      }
      return { data: null, error: null };
    }

    if (table === 'transactions') {
      if (insert) {
        const rows = insert[1][0] as Record<string, unknown>[];
        state.transactionInserts.push(rows);
        if (options.failTransactionInsert) {
          return { data: null, error: { message: options.failTransactionInsert } };
        }
        const created = rows.map((r) => ({ id: `tx-new-${++seq}`, ...r }) as FakeRow);
        state.transactions.push(...created);
        return { data: created, error: null };
      }
      if (options.failTransactionSelect) {
        return { data: null, error: { message: options.failTransactionSelect } };
      }
      const orOp = has('or');
      const filter = (orOp?.[1][0] as string | undefined) ?? '';
      return { data: state.transactions.filter((r) => matchesOrFilter(r, filter)), error: null };
    }

    return { data: null, error: null };
  };

  const from = vi.fn((table: string) => {
    const ops: Op[] = [];
    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'is', 'in', 'or', 'insert', 'update', 'order', 'range']) {
      builder[m] = (...args: unknown[]) => {
        ops.push([m, args]);
        return builder;
      };
    }
    builder.single = () => Promise.resolve(resolve(table, ops));
    builder.maybeSingle = () => Promise.resolve(resolve(table, ops));
    builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(resolve(table, ops)).then(onFulfilled, onRejected);
    return builder;
  });

  return { client: { from, rpc }, state };
}
