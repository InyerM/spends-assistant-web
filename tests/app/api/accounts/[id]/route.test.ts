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

  it('soft-deletes account and cascades to transactions', async () => {
    const { getUserClient } = await import('@/lib/api/server');

    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    ['select', 'eq', 'is', 'update'].forEach((m) => {
      chain[m] = vi.fn().mockReturnValue(chain);
    });

    // First call is is_default check via .single(), rest are updates via thenable
    chain.single = vi.fn().mockResolvedValue({ data: { is_default: false }, error: null });

    Object.defineProperty(chain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ error: null }),
      enumerable: false,
      configurable: true,
    });

    vi.mocked(getUserClient).mockResolvedValue({
      supabase: { from: vi.fn().mockReturnValue(chain) } as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/accounts/acc-1', { method: 'DELETE' });
    const response = await DELETE(request, makeParams('acc-1'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it('returns 403 when deleting default account', async () => {
    const { getUserClient } = await import('@/lib/api/server');

    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    ['select', 'eq', 'is', 'update'].forEach((m) => {
      chain[m] = vi.fn().mockReturnValue(chain);
    });

    chain.single = vi.fn().mockResolvedValue({ data: { is_default: true }, error: null });

    vi.mocked(getUserClient).mockResolvedValue({
      supabase: { from: vi.fn().mockReturnValue(chain) } as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/accounts/acc-1', { method: 'DELETE' });
    const response = await DELETE(request, makeParams('acc-1'));
    expect(response.status).toBe(403);
  });

  it('returns 400 on account delete error', async () => {
    const { getUserClient } = await import('@/lib/api/server');

    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    ['select', 'eq', 'is', 'update'].forEach((m) => {
      chain[m] = vi.fn().mockReturnValue(chain);
    });

    // is_default check passes
    chain.single = vi.fn().mockResolvedValue({ data: { is_default: false }, error: null });

    Object.defineProperty(chain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ error: { message: 'Cannot delete' } }),
      enumerable: false,
      configurable: true,
    });

    vi.mocked(getUserClient).mockResolvedValue({
      supabase: { from: vi.fn().mockReturnValue(chain) } as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/accounts/acc-1', { method: 'DELETE' });
    const response = await DELETE(request, makeParams('acc-1'));
    expect(response.status).toBe(400);
  });
});
