import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/transactions/bulk-delete/route';

vi.mock('@/lib/api/server', () => ({
  getUserClient: vi.fn(),
  AuthError: class AuthError extends Error {},
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (message: string, status = 500) => Response.json({ error: message }, { status }),
  applyTransactionBalance: vi.fn(),
}));

function request(ids: unknown): NextRequest {
  return new NextRequest('http://localhost/api/transactions/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}

describe('POST /api/transactions/bulk-delete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses a single atomic RPC and returns the number actually deleted', async () => {
    const { getUserClient, applyTransactionBalance } = await import('@/lib/api/server');
    const rpc = vi.fn().mockResolvedValue({ data: 1, error: null });
    vi.mocked(getUserClient).mockResolvedValue({ supabase: { rpc } as never, userId: 'owner' });

    const response = await POST(request(['tx-a', 'tx-b']));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, deletedCount: 1 });
    expect(rpc).toHaveBeenCalledWith('soft_delete_transactions', {
      p_transaction_ids: ['tx-a', 'tx-b'],
    });
    expect(applyTransactionBalance).not.toHaveBeenCalled();
  });

  it('returns 404 when none of the IDs is active for the owner', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: { rpc: vi.fn().mockResolvedValue({ data: 0, error: null }) } as never,
      userId: 'owner',
    });
    expect((await POST(request(['tx-a']))).status).toBe(404);
  });

  it('rejects invalid ID lists before calling the RPC', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const rpc = vi.fn();
    vi.mocked(getUserClient).mockResolvedValue({ supabase: { rpc } as never, userId: 'owner' });
    expect((await POST(request([]))).status).toBe(400);
    expect((await POST(request('tx-a'))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each(['Reviewed transaction cannot be deleted', 'Transaction has a reviewed wealth link'])(
    'returns 409 when a requested transaction is protected by %s',
    async (message) => {
      const { getUserClient } = await import('@/lib/api/server');
      vi.mocked(getUserClient).mockResolvedValue({
        supabase: {
          rpc: vi.fn().mockResolvedValue({
            data: null,
            error: { message },
          }),
        } as never,
        userId: 'owner',
      });
      expect((await POST(request(['tx-a']))).status).toBe(409);
    },
  );
});
