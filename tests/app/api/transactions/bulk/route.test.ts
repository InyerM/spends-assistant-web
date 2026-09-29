import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH } from '@/app/api/transactions/bulk/route';
import { NextRequest } from 'next/server';

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

function createChainableQuery(
  data: unknown,
  error: { message: string } | null = null,
  category: { id: string; type: string } | null = null,
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  ['select', 'eq', 'is', 'in', 'update'].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });

  Object.defineProperty(chain, 'then', {
    value: (resolve: (v: unknown) => void) =>
      resolve({
        data: Array.isArray(data) ? data : data ? [data] : [],
        error,
      }),
    enumerable: false,
    configurable: true,
  });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: category, error: null });

  return { from: vi.fn().mockReturnValue(chain), _chain: chain };
}

describe('PATCH /api/transactions/bulk', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('bulk updates transaction descriptions', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const updated = [
      { id: 'tx-1', description: 'Reviewed' },
      { id: 'tx-2', description: 'Reviewed' },
    ];
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: createChainableQuery(updated) as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/transactions/bulk', {
      method: 'PATCH',
      body: JSON.stringify({
        ids: ['tx-1', 'tx-2'],
        updates: { description: 'Reviewed' },
      }),
    });
    const response = await PATCH(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveLength(2);
  });

  it('rejects a category that does not match every selected transaction type', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const db = createChainableQuery([{ id: 'tx-1', type: 'income' }], null, {
      id: 'cat-1',
      type: 'expense',
    });
    vi.mocked(getUserClient).mockResolvedValue({ supabase: db as never, userId: 'test-user-id' });
    const response = await PATCH(
      new NextRequest('http://localhost/api/transactions/bulk', {
        method: 'PATCH',
        body: JSON.stringify({ ids: ['tx-1'], updates: { category_id: 'cat-1' } }),
      }),
    );
    expect(response.status).toBe(400);
    expect(db._chain.update).not.toHaveBeenCalled();
  });

  it('updates a category only when it belongs to the user and matches the selected type', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const db = createChainableQuery([{ id: 'tx-1', type: 'expense' }], null, {
      id: 'cat-1',
      type: 'expense',
    });
    vi.mocked(getUserClient).mockResolvedValue({ supabase: db as never, userId: 'test-user-id' });
    const response = await PATCH(
      new NextRequest('http://localhost/api/transactions/bulk', {
        method: 'PATCH',
        body: JSON.stringify({ ids: ['tx-1'], updates: { category_id: 'cat-1' } }),
      }),
    );
    expect(response.status).toBe(200);
    expect(db._chain.eq).toHaveBeenCalledWith('type', 'expense');
    expect(db._chain.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
  });

  it('returns 400 when ids empty', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: createChainableQuery([]) as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/transactions/bulk', {
      method: 'PATCH',
      body: JSON.stringify({ ids: [], updates: { category_id: 'cat-1' } }),
    });
    const response = await PATCH(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 when updates empty', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: createChainableQuery([]) as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/transactions/bulk', {
      method: 'PATCH',
      body: JSON.stringify({ ids: ['tx-1'], updates: {} }),
    });
    const response = await PATCH(request);
    expect(response.status).toBe(400);
  });

  it.each(['amount', 'type', 'account_id', 'transfer_to_account_id', 'deleted_at', 'user_id'])(
    'rejects bulk changes to %s before any write',
    async (field) => {
      const { getUserClient } = await import('@/lib/api/server');
      const db = createChainableQuery([]);
      vi.mocked(getUserClient).mockResolvedValue({ supabase: db as never, userId: 'test-user-id' });
      const response = await PATCH(
        new NextRequest('http://localhost/api/transactions/bulk', {
          method: 'PATCH',
          body: JSON.stringify({ ids: ['tx-1'], updates: { [field]: 100 } }),
        }),
      );
      expect(response.status).toBe(400);
      expect(db._chain.update).not.toHaveBeenCalled();
    },
  );

  it('returns 400 on DB error', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: createChainableQuery(null, { message: 'Bulk update failed' }) as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/transactions/bulk', {
      method: 'PATCH',
      body: JSON.stringify({ ids: ['tx-1'], updates: { category_id: 'cat-1' } }),
    });
    const response = await PATCH(request);
    expect(response.status).toBe(400);
  });
});
