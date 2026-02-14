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

function createAccountPostMock(
  insertData: unknown,
  insertError: { message: string } | null = null,
  opts: { accountCount?: number } = {},
) {
  const { accountCount = 0 } = opts;

  function makeChain(thenResult: unknown, singleResult?: unknown) {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    ['select', 'eq', 'is', 'order', 'insert'].forEach((m) => {
      chain[m] = vi.fn().mockReturnValue(chain);
    });
    chain.maybeSingle = vi.fn().mockResolvedValue(thenResult);
    chain.single = vi.fn().mockResolvedValue(singleResult ?? thenResult);
    Object.defineProperty(chain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve(thenResult),
      enumerable: false,
      configurable: true,
    });
    return chain;
  }

  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === 'subscriptions') {
      return makeChain({ data: null, error: null });
    }
    if (table === 'app_settings') {
      return makeChain({ data: null, error: null });
    }
    // accounts — used for count query (thenable) and insert query (.single())
    return makeChain(
      { data: null, error: null, count: accountCount },
      { data: insertData, error: insertError },
    );
  });

  return { from: fromMock };
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
      supabase: createAccountPostMock(account) as never,
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
      supabase: createAccountPostMock(null, { message: 'Duplicate name' }) as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Existing' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 403 when free plan account limit reached', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: createAccountPostMock(null, null, { accountCount: 4 }) as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Fifth Account', type: 'checking' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toContain('Account limit reached');
  });
});
