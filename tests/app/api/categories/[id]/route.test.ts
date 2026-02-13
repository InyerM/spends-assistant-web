import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH, DELETE } from '@/app/api/categories/[id]/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server', () => ({
  getAdminClient: vi.fn(),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (message: string, status = 500) => Response.json({ error: message }, { status }),
}));

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function createCategoryChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  ['select', 'eq', 'is', 'in', 'update', 'insert', 'delete', 'order'].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  return chain;
}

describe('GET /api/categories/[id]', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns category when found', async () => {
    const { getAdminClient } = await import('@/lib/api/server');
    const category = { id: 'cat-1', name: 'Food' };

    const chain = createCategoryChain();
    chain.single = vi.fn().mockResolvedValue({ data: category, error: null });

    vi.mocked(getAdminClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as never);

    const request = new NextRequest('http://localhost/api/categories/cat-1');
    const response = await GET(request, makeParams('cat-1'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe('cat-1');
  });

  it('returns 404 when not found', async () => {
    const { getAdminClient } = await import('@/lib/api/server');
    const chain = createCategoryChain();
    chain.single = vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } });

    vi.mocked(getAdminClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as never);

    const request = new NextRequest('http://localhost/api/categories/cat-999');
    const response = await GET(request, makeParams('cat-999'));
    expect(response.status).toBe(404);
  });

  it('includes counts when requested', async () => {
    const { getAdminClient } = await import('@/lib/api/server');
    const category = { id: 'cat-1', name: 'Food' };

    const chain = createCategoryChain();
    chain.single = vi.fn().mockResolvedValue({ data: category, error: null });

    // Make chain thenable for count queries
    Object.defineProperty(chain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ count: 5 }),
      enumerable: false,
      configurable: true,
    });

    vi.mocked(getAdminClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as never);

    const request = new NextRequest('http://localhost/api/categories/cat-1?include_counts=true');
    const response = await GET(request, makeParams('cat-1'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.transaction_count).toBe(5);
    expect(body.children_count).toBe(5);
  });
});

describe('PATCH /api/categories/[id]', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('updates category', async () => {
    const { getAdminClient } = await import('@/lib/api/server');
    const updated = { id: 'cat-1', name: 'Updated' };
    const chain = createCategoryChain();
    chain.single = vi.fn().mockResolvedValue({ data: updated, error: null });

    vi.mocked(getAdminClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as never);

    const request = new NextRequest('http://localhost/api/categories/cat-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
    });
    const response = await PATCH(request, makeParams('cat-1'));
    expect(response.status).toBe(200);
  });

  it('returns 400 on update error', async () => {
    const { getAdminClient } = await import('@/lib/api/server');
    const chain = createCategoryChain();
    chain.single = vi.fn().mockResolvedValue({ data: null, error: { message: 'Update failed' } });

    vi.mocked(getAdminClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as never);

    const request = new NextRequest('http://localhost/api/categories/cat-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: '' }),
    });
    const response = await PATCH(request, makeParams('cat-1'));
    expect(response.status).toBe(400);
  });
});

describe('DELETE /api/categories/[id]', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('soft-deletes category with cascade', async () => {
    const { getAdminClient } = await import('@/lib/api/server');

    const chain = createCategoryChain();

    // Track from() calls to differentiate tables
    let thenCallCount = 0;
    Object.defineProperty(chain, 'then', {
      value: (resolve: (v: unknown) => void) => {
        thenCallCount++;
        // Call 1: count unlinked transactions
        if (thenCallCount === 1) return resolve({ count: 3 });
        // Call 2: update transactions (unlink)
        if (thenCallCount === 2) return resolve({ error: null });
        // Call 3: find children
        if (thenCallCount === 3) return resolve({ data: [{ id: 'child-1' }], error: null });
        // Call 4: count child transactions
        if (thenCallCount === 4) return resolve({ count: 2 });
        // Call 5-7: unlink child transactions, delete children, delete category
        return resolve({ error: null });
      },
      enumerable: false,
      configurable: true,
    });

    vi.mocked(getAdminClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as never);

    const request = new NextRequest('http://localhost/api/categories/cat-1', { method: 'DELETE' });
    const response = await DELETE(request, makeParams('cat-1'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.unlinked_transactions).toBe(5);
  });

  it('handles category with no children', async () => {
    const { getAdminClient } = await import('@/lib/api/server');

    const chain = createCategoryChain();

    let thenCallCount = 0;
    Object.defineProperty(chain, 'then', {
      value: (resolve: (v: unknown) => void) => {
        thenCallCount++;
        if (thenCallCount === 1) return resolve({ count: 1 });
        if (thenCallCount === 2) return resolve({ error: null });
        // No children
        if (thenCallCount === 3) return resolve({ data: [], error: null });
        return resolve({ error: null });
      },
      enumerable: false,
      configurable: true,
    });

    vi.mocked(getAdminClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as never);

    const request = new NextRequest('http://localhost/api/categories/cat-1', { method: 'DELETE' });
    const response = await DELETE(request, makeParams('cat-1'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.unlinked_transactions).toBe(1);
  });

  it('returns 400 on delete error', async () => {
    const { getAdminClient } = await import('@/lib/api/server');

    const chain = createCategoryChain();

    let thenCallCount = 0;
    Object.defineProperty(chain, 'then', {
      value: (resolve: (v: unknown) => void) => {
        thenCallCount++;
        if (thenCallCount <= 2) return resolve({ count: 0 });
        if (thenCallCount === 3) return resolve({ data: [], error: null });
        // Delete fails
        return resolve({ error: { message: 'Cannot delete' } });
      },
      enumerable: false,
      configurable: true,
    });

    vi.mocked(getAdminClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as never);

    const request = new NextRequest('http://localhost/api/categories/cat-1', { method: 'DELETE' });
    const response = await DELETE(request, makeParams('cat-1'));
    expect(response.status).toBe(400);
  });
});
