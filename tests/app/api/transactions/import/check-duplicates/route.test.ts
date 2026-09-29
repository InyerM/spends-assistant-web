import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/transactions/import/check-duplicates/route';
import { NextRequest } from 'next/server';
import { getUserClient } from '@/lib/api/server';
import { createFakeSupabase, type FakeDbOptions } from '../fake-supabase';

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

const EXISTING = {
  id: 'tx-existing',
  date: '2024-01-15',
  amount: 50000,
  description: 'Lunch',
  account_id: 'acc-1',
};

function setup(options: FakeDbOptions = {}) {
  const fake = createFakeSupabase({ accounts: [{ id: 'acc-1', name: 'Checking' }], ...options });
  vi.mocked(getUserClient).mockResolvedValue({
    supabase: fake.client as never,
    userId: 'test-user-id',
  });
  return fake;
}

function post(transactions: unknown) {
  return POST(
    new NextRequest('http://localhost/api/transactions/import/check-duplicates', {
      method: 'POST',
      body: JSON.stringify({ transactions }),
    }),
  );
}

describe('POST /api/transactions/import/check-duplicates', () => {
  beforeEach(() => {
    vi.mocked(getUserClient).mockReset();
  });

  it('returns matches by account name (case-insensitive) and by account_id', async () => {
    setup({ transactions: [EXISTING] });
    const response = await post([
      { date: '2024-01-15', amount: 50000, account: 'checking' },
      { date: '2024-01-15', amount: 50000, account_id: 'acc-1' },
      { date: '2024-01-16', amount: 50000, account: 'Checking' },
    ]);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.duplicates).toEqual([
      { index: 0, match: EXISTING },
      { index: 1, match: EXISTING },
    ]);
    expect(body.unresolved_accounts).toEqual([]);
  });

  it('reports unresolved account names', async () => {
    setup({ transactions: [EXISTING] });
    const body = await (await post([{ date: '2024-01-15', amount: 1, account: 'Nope' }])).json();
    expect(body.duplicates).toEqual([]);
    expect(body.unresolved_accounts).toEqual(['Nope']);
  });

  it('returns an empty list for an empty payload', async () => {
    setup();
    expect(await (await post([])).json()).toEqual({ duplicates: [], unresolved_accounts: [] });
  });

  it('rejects malformed rows', async () => {
    setup();
    expect((await post([{ date: 'bad', amount: 1, account: 'Checking' }])).status).toBe(400);
  });

  it('returns 500 instead of an empty list when the lookup fails', async () => {
    setup({ failTransactionSelect: 'boom' });
    const response = await post([{ date: '2024-01-15', amount: 1, account: 'Checking' }]);
    expect(response.status).toBe(500);
  });
});
