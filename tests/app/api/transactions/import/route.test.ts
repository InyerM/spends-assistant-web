import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/transactions/import/route';
import { NextRequest } from 'next/server';
import { getUserClient } from '@/lib/api/server';
import { createFakeSupabase, type FakeDbOptions } from './fake-supabase';

vi.mock('@/lib/api/server', () => ({
  getUserClient: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(m = 'Unauthorized') {
      super(m);
      this.name = 'AuthError';
    }
  },
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (message: string, status = 500) => Response.json({ error: message }, { status }),
}));

const ACCOUNTS = [{ id: 'acc-1', name: 'Checking' }];
const CATEGORIES = [{ id: 'cat-1', name: 'Food' }];

function row(overrides: Record<string, unknown> = {}) {
  return {
    date: '2024-01-15',
    time: '14:30:00',
    amount: 50000,
    description: 'Lunch',
    notes: null,
    type: 'expense',
    account: 'Checking',
    category: 'Food',
    payment_method: null,
    source: 'csv_import',
    ...overrides,
  };
}

function setup(options: FakeDbOptions = {}) {
  const fake = createFakeSupabase({ accounts: ACCOUNTS, categories: CATEGORIES, ...options });
  vi.mocked(getUserClient).mockResolvedValue({
    supabase: fake.client as never,
    userId: 'test-user-id',
  });
  return fake;
}

function post(body: Record<string, unknown>) {
  return POST(
    new NextRequest('http://localhost/api/transactions/import', {
      method: 'POST',
      body: JSON.stringify({
        resolve_names: true,
        file_name: 'bank.csv',
        request_id: '00000000-0000-4000-8000-000000000001',
        ...body,
      }),
    }),
  );
}

const EXISTING = {
  id: 'tx-existing',
  date: '2024-01-15',
  amount: 50000,
  description: 'Lunch',
  account_id: 'acc-1',
};

describe('POST /api/transactions/import', () => {
  beforeEach(() => {
    vi.mocked(getUserClient).mockReset();
  });

  it('imports rows without matches, resolving account and category names', async () => {
    const fake = setup();
    const response = await post({ transactions: [row(), row({ date: '2024-01-16' })] });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.imported).toBe(2);
    expect(body.skipped).toBe(0);
    expect(fake.state.transactionInserts[0][0]).toMatchObject({
      account_id: 'acc-1',
      category_id: 'cat-1',
      user_id: 'test-user-id',
      import_id: body.import_id,
    });
    expect(fake.state.transactionInserts[0][0]).not.toHaveProperty('account');
    expect(fake.state.transactionInserts[0][0]).not.toHaveProperty('duplicate_status');
    expect(fake.state.imports.at(-1)).toMatchObject({
      status: 'completed',
      imported_count: 2,
    });
  });

  it('keeps legitimate equal-amount payments in the same file when nothing exists yet', async () => {
    const fake = setup();
    const response = await post({ transactions: [row(), row()] });

    expect(response.status).toBe(201);
    expect((await response.json()).imported).toBe(2);
    expect(fake.state.transactionInserts[0]).toHaveLength(2);
  });

  it('only accepts whitelisted columns from the client', async () => {
    const fake = setup();
    await post({
      transactions: [
        row({ user_id: 'someone-else', duplicate_status: 'confirmed', deleted_at: 'x' }),
      ],
    });
    const inserted = fake.state.transactionInserts[0][0];
    expect(inserted.user_id).toBe('test-user-id');
    expect(inserted).not.toHaveProperty('duplicate_status');
    expect(inserted).not.toHaveProperty('deleted_at');
  });

  describe('existing matches', () => {
    it('rejects with 409 and writes nothing when a row matches an existing transaction', async () => {
      const fake = setup({ transactions: [EXISTING] });
      const response = await post({ transactions: [row(), row({ date: '2024-02-01' })] });

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.duplicates).toEqual([{ index: 0, match: EXISTING }]);
      expect(body.unreviewed).toEqual([0]);
      expect(fake.state.imports).toHaveLength(0);
      expect(fake.state.transactionInserts).toHaveLength(0);
    });

    it('matches on account_id as well as account name', async () => {
      const fake = setup({ transactions: [EXISTING] });
      const response = await post({
        transactions: [row({ account: undefined, account_id: 'acc-1' })],
      });

      expect(response.status).toBe(409);
      expect(fake.state.transactionInserts).toHaveLength(0);
    });

    it('skips reviewed rows with decision skip and imports the rest', async () => {
      const fake = setup({ transactions: [EXISTING] });
      const response = await post({
        transactions: [row(), row({ date: '2024-02-01' })],
        duplicate_reviews: [{ index: 0, match_ids: ['tx-existing'], decision: 'skip' }],
      });

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body).toMatchObject({ imported: 1, skipped: 1 });
      expect(fake.state.transactionInserts[0]).toHaveLength(1);
      expect(fake.state.transactionInserts[0][0].date).toBe('2024-02-01');
    });

    it('imports reviewed rows with decision import as confirmed', async () => {
      const fake = setup({ transactions: [EXISTING] });
      const response = await post({
        transactions: [row()],
        duplicate_reviews: [{ index: 0, match_ids: ['tx-existing'], decision: 'import' }],
      });

      expect(response.status).toBe(201);
      expect(fake.state.transactionInserts[0][0].duplicate_status).toBe('confirmed');
    });

    it('fails closed when the duplicate lookup errors', async () => {
      const fake = setup({ failTransactionSelect: 'timeout' });
      const response = await post({ transactions: [row()] });

      expect(response.status).toBe(500);
      expect(fake.state.imports).toHaveLength(0);
      expect(fake.state.transactionInserts).toHaveLength(0);
    });

    it('records a completed import when every row is skipped', async () => {
      const fake = setup({ transactions: [EXISTING] });
      const response = await post({
        transactions: [row()],
        duplicate_reviews: [{ index: 0, match_ids: ['tx-existing'], decision: 'skip' }],
      });

      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({ imported: 0, skipped: 1 });
      expect(fake.state.imports).toHaveLength(1);
    });
  });

  describe('repeated submissions', () => {
    it('replays an identical request without writing again', async () => {
      const fake = setup();
      const payload = { transactions: [row(), row({ date: '2024-01-16', amount: 10 })] };

      expect((await post(payload)).status).toBe(201);
      const second = await post(payload);

      expect(second.status).toBe(200);
      expect((await second.json()).replayed).toBe(true);
      expect(fake.state.transactionInserts).toHaveLength(1);
      expect(fake.state.transactions).toHaveLength(2);
    });

    it('replays a reviewed request without writing again', async () => {
      const fake = setup({ transactions: [EXISTING] });
      const payload = {
        transactions: [row()],
        duplicate_reviews: [{ index: 0, match_ids: ['tx-existing'], decision: 'import' }],
      };

      expect((await post(payload)).status).toBe(201);
      const replay = await post(payload);

      expect(replay.status).toBe(200);
      expect((await replay.json()).replayed).toBe(true);
      expect(fake.state.transactionInserts).toHaveLength(1);
    });
  });

  describe('force review', () => {
    it('rejects the legacy force flag instead of bypassing review', async () => {
      const fake = setup({ transactions: [EXISTING] });
      const response = await post({ transactions: [row()], force: true });

      expect(response.status).toBe(400);
      expect(fake.state.transactionInserts).toHaveLength(0);
    });

    it('rejects a review that does not cover a newly appeared match', async () => {
      const fake = setup({
        transactions: [EXISTING, { ...EXISTING, id: 'tx-newer', description: 'Other' }],
      });
      const response = await post({
        transactions: [row()],
        duplicate_reviews: [{ index: 0, match_ids: ['tx-existing'], decision: 'import' }],
      });

      expect(response.status).toBe(409);
      expect((await response.json()).stale).toEqual([0]);
      expect(fake.state.transactionInserts).toHaveLength(0);
    });

    it('rejects malformed reviews', async () => {
      const fake = setup({ transactions: [EXISTING] });
      const response = await post({
        transactions: [row()],
        duplicate_reviews: [{ index: 7, match_ids: ['tx-existing'], decision: 'import' }],
      });

      expect(response.status).toBe(400);
      expect(fake.state.transactionInserts).toHaveLength(0);
    });
  });

  describe('unresolved names', () => {
    it('rejects the whole import when any account cannot be resolved', async () => {
      const fake = setup();
      const response = await post({
        transactions: [row(), row({ account: 'Unknown bank', date: '2024-01-20' })],
      });

      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error).toContain('Unknown bank');
      expect(body.unresolved_accounts).toEqual(['Unknown bank']);
      expect(fake.state.imports).toHaveLength(0);
      expect(fake.state.transactionInserts).toHaveLength(0);
    });

    it('rejects an account_id that does not belong to the user', async () => {
      const fake = setup();
      const response = await post({ transactions: [row({ account_id: 'acc-foreign' })] });

      expect(response.status).toBe(422);
      expect(fake.state.transactionInserts).toHaveLength(0);
    });

    it('imports with a null category and reports unknown category names', async () => {
      const fake = setup();
      const response = await post({ transactions: [row({ category: 'Mystery' })] });

      expect(response.status).toBe(201);
      expect((await response.json()).errors[0]).toContain('Mystery');
      expect(fake.state.transactionInserts[0][0].category_id).toBeNull();
    });
  });

  describe('partial failures', () => {
    it('rolls back rows when completing the import fails', async () => {
      const fake = setup({ failImportUpdate: 'update failed' });
      const response = await post({ transactions: [row()] });

      expect(response.status).toBe(500);
      expect(fake.state.transactions).toHaveLength(0);
      expect(fake.state.imports).toHaveLength(0);
    });
    it('rolls back the import when the transaction insert fails', async () => {
      const fake = setup({ failTransactionInsert: 'insert failed' });
      const response = await post({ transactions: [row()] });

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toContain('insert failed');
      expect(fake.state.transactions).toHaveLength(0);
      expect(fake.state.imports).toHaveLength(0);
    });

    it('does not insert transactions when the import record cannot be created', async () => {
      const fake = setup({ failImportInsert: 'imports down' });
      const response = await post({ transactions: [row()] });

      expect(response.status).toBe(500);
      expect(fake.state.transactionInserts).toHaveLength(0);
    });

    it('rejects reusing a request id for changed rows', async () => {
      const fake = setup();
      expect((await post({ transactions: [row()] })).status).toBe(201);
      expect((await post({ transactions: [row({ amount: 10 })] })).status).toBe(500);
      expect(fake.state.transactions).toHaveLength(1);
    });
  });

  describe('validation and limits', () => {
    it('returns 400 when no transactions are provided', async () => {
      setup();
      expect((await post({ transactions: [] })).status).toBe(400);
    });

    it('returns 400 for malformed rows', async () => {
      const fake = setup();
      const response = await post({ transactions: [row({ date: '2024-01-15),or(id.eq.x' })] });
      expect(response.status).toBe(400);
      expect(fake.state.transactionInserts).toHaveLength(0);
    });

    it('enforces the free plan limit on rows that will actually be inserted', async () => {
      setup({ plan: 'free', transactionsCount: 49, transactions: [EXISTING] });
      const response = await post({
        transactions: [row(), row({ date: '2024-02-01' })],
        duplicate_reviews: [{ index: 0, match_ids: ['tx-existing'], decision: 'skip' }],
      });
      expect(response.status).toBe(201);

      const overLimit = await post({
        request_id: '00000000-0000-4000-8000-000000000002',
        transactions: [row({ date: '2024-03-01' }), row({ date: '2024-03-02' })],
      });
      expect(overLimit.status).toBe(403);
    });

    it('returns 401 when unauthenticated', async () => {
      const { AuthError } = await import('@/lib/api/server');
      vi.mocked(getUserClient).mockRejectedValue(new AuthError());
      expect((await post({ transactions: [row()] })).status).toBe(401);
    });
  });
});
