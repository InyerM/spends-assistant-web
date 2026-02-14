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

function createChainableQuery(data: unknown, error: { message: string } | null = null) {
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

  return { from: vi.fn().mockReturnValue(chain), _chain: chain };
}

describe('PATCH /api/transactions/bulk', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('bulk updates transactions', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const updated = [
      { id: 'tx-1', category_id: 'cat-1' },
      { id: 'tx-2', category_id: 'cat-1' },
    ];
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: createChainableQuery(updated) as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/transactions/bulk', {
      method: 'PATCH',
      body: JSON.stringify({
        ids: ['tx-1', 'tx-2'],
        updates: { category_id: 'cat-1' },
      }),
    });
    const response = await PATCH(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveLength(2);
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
