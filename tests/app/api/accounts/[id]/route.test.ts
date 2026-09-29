import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH, DELETE } from '@/app/api/accounts/[id]/route';
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
  ['select', 'eq', 'is', 'update', 'insert'].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.single = vi.fn().mockResolvedValue({ data, error });

  Object.defineProperty(chain, 'then', {
    value: (resolve: (v: unknown) => void) => resolve({ data, error }),
    enumerable: false,
    configurable: true,
  });

  return { from: vi.fn().mockReturnValue(chain), _chain: chain };
}

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/accounts/[id]', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns account when found', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const account = { id: 'acc-1', name: 'Checking' };
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: createChainableQuery(account) as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/accounts/acc-1');
    const response = await GET(request, makeParams('acc-1'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe('acc-1');
  });

  it('returns 404 when not found', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: createChainableQuery(null, { message: 'Not found' }) as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/accounts/acc-999');
    const response = await GET(request, makeParams('acc-999'));
    expect(response.status).toBe(404);
  });
});

describe('PATCH /api/accounts/[id]', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('updates account', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const updated = { id: 'acc-1', name: 'Updated' };
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: createChainableQuery(updated) as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/accounts/acc-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
    });
    const response = await PATCH(request, makeParams('acc-1'));
    expect(response.status).toBe(200);
  });

  it('rejects direct balance or ownership changes without writing', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const client = createChainableQuery({ id: 'acc-1' });
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: client as never,
      userId: 'test-user-id',
    });
    for (const payload of [{ balance: 900 }, { user_id: 'other' }, { deleted_at: 'now' }]) {
      const response = await PATCH(
        new NextRequest('http://localhost/api/accounts/acc-1', {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }),
        makeParams('acc-1'),
      );
      expect(response.status).toBe(400);
    }
    expect(client._chain.update).not.toHaveBeenCalled();
  });

  it('scopes metadata updates to an active account owned by the caller', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const client = createChainableQuery({ id: 'acc-1', name: 'Updated' });
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: client as never,
      userId: 'test-user-id',
    });
    const response = await PATCH(
      new NextRequest('http://localhost/api/accounts/acc-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated' }),
      }),
      makeParams('acc-1'),
    );
    expect(response.status).toBe(200);
    expect(client._chain.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
    expect(client._chain.is).toHaveBeenCalledWith('deleted_at', null);
  });

  it('returns 400 on update error', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: createChainableQuery(null, { message: 'Update failed' }) as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/accounts/acc-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: '' }),
    });
    const response = await PATCH(request, makeParams('acc-1'));
    expect(response.status).toBe(400);
  });
});

describe('DELETE /api/accounts/[id]', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls the guarded account RPC and never updates transactions directly', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const from = vi.fn();
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: { from, rpc } as never,
      userId: 'test-user-id',
    });
    const request = new NextRequest('http://localhost/api/accounts/acc-1', { method: 'DELETE' });
    const response = await DELETE(request, makeParams('acc-1'));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('soft_delete_empty_account', { p_account_id: 'acc-1' });
    expect(from).not.toHaveBeenCalled();
  });

  it('returns 409 and preserves data when the account has active transactions', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '23514', message: 'Account has active transactions' },
    });
    const from = vi.fn();
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: { from, rpc } as never,
      userId: 'test-user-id',
    });
    const request = new NextRequest('http://localhost/api/accounts/acc-1', { method: 'DELETE' });
    const response = await DELETE(request, makeParams('acc-1'));
    expect(response.status).toBe(409);
    expect(from).not.toHaveBeenCalled();
  });

  it('returns 403 for a default account', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '23514', message: 'Default account cannot be deleted' },
    });
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: { rpc } as never,
      userId: 'test-user-id',
    });
    const request = new NextRequest('http://localhost/api/accounts/acc-1', { method: 'DELETE' });
    const response = await DELETE(request, makeParams('acc-1'));
    expect(response.status).toBe(403);
  });
});
