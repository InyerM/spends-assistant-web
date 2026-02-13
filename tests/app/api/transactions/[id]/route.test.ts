import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH, DELETE } from '@/app/api/transactions/[id]/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server', () => ({
  getAdminClient: vi.fn(),
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
    const { getAdminClient } = await import('@/lib/api/server');
    const tx = { id: 'tx-1', description: 'Test' };
    vi.mocked(getAdminClient).mockReturnValue(createChainableQuery(tx) as never);

    const request = new NextRequest('http://localhost/api/transactions/tx-1');
    const response = await GET(request, makeParams('tx-1'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe('tx-1');
  });

  it('returns 404 when not found', async () => {
    const { getAdminClient } = await import('@/lib/api/server');
    vi.mocked(getAdminClient).mockReturnValue(
      createChainableQuery(null, { message: 'Not found' }) as never,
    );

    const request = new NextRequest('http://localhost/api/transactions/tx-999');
    const response = await GET(request, makeParams('tx-999'));
    expect(response.status).toBe(404);
  });
});

describe('PATCH /api/transactions/[id]', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
  });

  it('updates transaction fields', async () => {
    const { getAdminClient, applyTransactionBalance } = await import('@/lib/api/server');
    const old = {
      type: 'expense',
      amount: 50000,
      account_id: 'acc-1',
      transfer_to_account_id: null,
    };
    const updated = { ...old, description: 'Updated' };

    let singleCallCount = 0;
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    ['select', 'eq', 'is', 'update'].forEach((m) => {
      chain[m] = vi.fn().mockReturnValue(chain);
    });
    chain.single = vi.fn().mockImplementation(async () => {
      singleCallCount++;
      if (singleCallCount === 1) return { data: old, error: null };
      return { data: updated, error: null };
    });
    vi.mocked(getAdminClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as never);
    vi.mocked(applyTransactionBalance).mockResolvedValue();

    const request = new NextRequest('http://localhost/api/transactions/tx-1', {
      method: 'PATCH',
      body: JSON.stringify({ description: 'Updated' }),
    });
    const response = await PATCH(request, makeParams('tx-1'));
    expect(response.status).toBe(200);
    // No balance change for description-only update
    expect(applyTransactionBalance).not.toHaveBeenCalled();
  });

  it('reverses and reapplies balance on amount change', async () => {
    const { getAdminClient, applyTransactionBalance } = await import('@/lib/api/server');
    const old = {
      type: 'expense',
      amount: 50000,
      account_id: 'acc-1',
      transfer_to_account_id: null,
    };
    const updated = {
      type: 'expense',
      amount: 75000,
      account_id: 'acc-1',
      transfer_to_account_id: null,
    };

    let singleCallCount = 0;
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    ['select', 'eq', 'is', 'update'].forEach((m) => {
      chain[m] = vi.fn().mockReturnValue(chain);
    });
    chain.single = vi.fn().mockImplementation(async () => {
      singleCallCount++;
      if (singleCallCount === 1) return { data: old, error: null };
      return { data: updated, error: null };
    });
    vi.mocked(getAdminClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as never);
    vi.mocked(applyTransactionBalance).mockResolvedValue();

    const request = new NextRequest('http://localhost/api/transactions/tx-1', {
      method: 'PATCH',
      body: JSON.stringify({ amount: 75000 }),
    });
    const response = await PATCH(request, makeParams('tx-1'));
    expect(response.status).toBe(200);
    // Should reverse old and apply new
    expect(applyTransactionBalance).toHaveBeenCalledTimes(2);
  });

  it('returns 400 on update error', async () => {
    const { getAdminClient } = await import('@/lib/api/server');
    const old = {
      type: 'expense',
      amount: 50000,
      account_id: 'acc-1',
      transfer_to_account_id: null,
    };

    let singleCallCount = 0;
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    ['select', 'eq', 'is', 'update'].forEach((m) => {
      chain[m] = vi.fn().mockReturnValue(chain);
    });
    chain.single = vi.fn().mockImplementation(async () => {
      singleCallCount++;
      if (singleCallCount === 1) return { data: old, error: null };
      return { data: null, error: { message: 'Update failed' } };
    });
    vi.mocked(getAdminClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as never);

    const request = new NextRequest('http://localhost/api/transactions/tx-1', {
      method: 'PATCH',
      body: JSON.stringify({ amount: 75000 }),
    });
    const response = await PATCH(request, makeParams('tx-1'));
    expect(response.status).toBe(400);
  });
});

describe('DELETE /api/transactions/[id]', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
  });

  it('soft-deletes and reverses balance for expense', async () => {
    const { getAdminClient, applyTransactionBalance } = await import('@/lib/api/server');
    const tx = {
      type: 'expense',
      amount: 50000,
      account_id: 'acc-1',
      transfer_to_account_id: null,
    };

    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    ['select', 'eq', 'is', 'update'].forEach((m) => {
      chain[m] = vi.fn().mockReturnValue(chain);
    });
    chain.single = vi.fn().mockImplementation(async () => {
      return { data: tx, error: null };
    });

    // Make update thenable for the delete update
    Object.defineProperty(chain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ error: null }),
      enumerable: false,
      configurable: true,
    });

    vi.mocked(getAdminClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as never);
    vi.mocked(applyTransactionBalance).mockResolvedValue();

    const request = new NextRequest('http://localhost/api/transactions/tx-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request, makeParams('tx-1'));
    expect(response.status).toBe(200);
    expect(applyTransactionBalance).toHaveBeenCalledWith(
      expect.anything(),
      'expense',
      'acc-1',
      50000,
      null,
      true,
    );
  });

  it('returns 400 on delete error', async () => {
    const { getAdminClient } = await import('@/lib/api/server');

    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    ['select', 'eq', 'is', 'update'].forEach((m) => {
      chain[m] = vi.fn().mockReturnValue(chain);
    });
    chain.single = vi.fn().mockResolvedValue({ data: null, error: null });

    // Make update thenable with error
    Object.defineProperty(chain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ error: { message: 'DB error' } }),
      enumerable: false,
      configurable: true,
    });

    vi.mocked(getAdminClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as never);

    const request = new NextRequest('http://localhost/api/transactions/tx-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request, makeParams('tx-1'));
    expect(response.status).toBe(400);
  });
});
