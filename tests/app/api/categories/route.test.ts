import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/categories/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server', () => ({
  getAdminClient: vi.fn(),
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

describe('GET /api/categories', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns list of categories', async () => {
    const { getAdminClient } = await import('@/lib/api/server');
    const categories = [
      { id: 'cat-1', name: 'Food' },
      { id: 'cat-2', name: 'Transport' },
    ];
    vi.mocked(getAdminClient).mockReturnValue(createChainableQuery(categories) as never);

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveLength(2);
  });

  it('returns 400 on error', async () => {
    const { getAdminClient } = await import('@/lib/api/server');
    vi.mocked(getAdminClient).mockReturnValue(
      createChainableQuery(null, { message: 'DB error' }) as never,
    );

    const response = await GET();
    expect(response.status).toBe(400);
  });
});

describe('POST /api/categories', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a category', async () => {
    const { getAdminClient } = await import('@/lib/api/server');
    const category = { id: 'cat-new', name: 'New Category' };
    vi.mocked(getAdminClient).mockReturnValue(createChainableQuery(category) as never);

    const request = new NextRequest('http://localhost/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Category' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(201);
  });

  it('returns 400 on create error', async () => {
    const { getAdminClient } = await import('@/lib/api/server');
    vi.mocked(getAdminClient).mockReturnValue(
      createChainableQuery(null, { message: 'Insert failed' }) as never,
    );

    const request = new NextRequest('http://localhost/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bad' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
