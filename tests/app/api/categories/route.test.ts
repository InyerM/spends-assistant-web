import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/categories/route';
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
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

  Object.defineProperty(chain, 'then', {
    value: (resolve: (v: unknown) => void) =>
      resolve({
        data: Array.isArray(data) ? data : data ? [data] : [],
        error,
        count: 0,
      }),
    enumerable: false,
    configurable: true,
  });

  return { from: vi.fn().mockReturnValue(chain), _chain: chain };
}

describe('GET /api/categories', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns list of categories', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const categories = [
      { id: 'cat-1', name: 'Food' },
      { id: 'cat-2', name: 'Transport' },
    ];
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: createChainableQuery(categories) as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/categories');
    const response = await GET(request);
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

    const request = new NextRequest('http://localhost/api/categories');
    const response = await GET(request);
    expect(response.status).toBe(400);
  });
});

describe('POST /api/categories', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a category', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const category = { id: 'cat-new', name: 'New Category' };
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: createChainableQuery(category) as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Category' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(201);
  });

  it('returns 400 on create error', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: createChainableQuery(null, { message: 'Insert failed' }) as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bad' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
