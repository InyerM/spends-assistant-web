import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, DELETE } from '@/app/api/transactions/[id]/route';
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
  applyTransactionBalance: vi.fn(),
}));

function createChainableQuery(data: unknown, error: { message: string } | null = null) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  ['select', 'eq', 'is', 'update', 'insert'].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.single = vi.fn().mockResolvedValue({ data, error });
  return { from: vi.fn().mockReturnValue(chain), _chain: chain };
}

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/transactions/[id]', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
  });

  it('returns transaction when found', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const tx = { id: 'tx-1', description: 'Test' };
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: createChainableQuery(tx) as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/transactions/tx-1');
    const response = await GET(request, makeParams('tx-1'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe('tx-1');
  });

  it('returns 404 when not found', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: createChainableQuery(null, { message: 'Not found' }) as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/transactions/tx-999');
    const response = await GET(request, makeParams('tx-999'));
    expect(response.status).toBe(404);
  });
});

describe('DELETE /api/transactions/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes through the atomic owner-scoped RPC without client-side balance changes', async () => {
    const { getUserClient, applyTransactionBalance } = await import('@/lib/api/server');
    const rpc = vi.fn().mockResolvedValue({ data: 1, error: null });
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: { rpc } as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/transactions/tx-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request, makeParams('tx-1'));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('soft_delete_transactions', { p_transaction_ids: ['tx-1'] });
    expect(applyTransactionBalance).not.toHaveBeenCalled();
  });

  it('returns a conflict for a reviewed transaction', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Reviewed transaction cannot be deleted' },
        }),
      } as never,
      userId: 'test-user-id',
    });
    const request = new NextRequest('http://localhost/api/transactions/tx-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request, makeParams('tx-1'));
    expect(response.status).toBe(409);
  });
});
