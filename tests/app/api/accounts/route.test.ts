import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/accounts/route';
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
  ['select', 'eq', 'is', 'order', 'insert'].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.single = vi.fn().mockResolvedValue({ data, error });

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

describe('GET /api/accounts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns list of accounts', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const accounts = [
      { id: 'acc-1', name: 'Checking' },
      { id: 'acc-2', name: 'Savings' },
    ];
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: createChainableQuery(accounts) as never,
      userId: 'test-user-id',
    });

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveLength(2);
  });

  it('returns 400 on error', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: createChainableQuery(null, { message: 'DB error' }) as never,
      userId: 'test-user-id',
    });

    const response = await GET();
    expect(response.status).toBe(400);
  });
});

describe('POST /api/accounts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an account', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const account = { id: 'acc-new', name: 'New Account' };
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: createChainableQuery(account) as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Account', type: 'checking' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(201);
  });

  it('returns 400 on create error', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: createChainableQuery(null, { message: 'Duplicate name' }) as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Existing' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
