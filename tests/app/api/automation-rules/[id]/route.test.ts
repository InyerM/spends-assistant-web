import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH, DELETE } from '@/app/api/automation-rules/[id]/route';
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
  ['select', 'eq', 'is', 'update', 'delete'].forEach((m) => {
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

describe('GET /api/automation-rules/[id]', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns rule when found', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const rule = { id: 'rule-1', name: 'Test Rule' };
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: createChainableQuery(rule) as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/automation-rules/rule-1');
    const response = await GET(request, makeParams('rule-1'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe('rule-1');
  });

  it('returns 404 when not found', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: createChainableQuery(null, { message: 'Not found' }) as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/automation-rules/rule-999');
    const response = await GET(request, makeParams('rule-999'));
    expect(response.status).toBe(404);
  });
});

describe('PATCH /api/automation-rules/[id]', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('updates rule', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const updated = { id: 'rule-1', name: 'Updated Rule' };
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: createChainableQuery(updated) as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/automation-rules/rule-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated Rule' }),
    });
    const response = await PATCH(request, makeParams('rule-1'));
    expect(response.status).toBe(200);
  });

  it('returns 400 on update error', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: createChainableQuery(null, { message: 'Update failed' }) as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/automation-rules/rule-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: '' }),
    });
    const response = await PATCH(request, makeParams('rule-1'));
    expect(response.status).toBe(400);
  });
});

describe('DELETE /api/automation-rules/[id]', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('deletes rule', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: createChainableQuery(null, null) as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/automation-rules/rule-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request, makeParams('rule-1'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it('returns 400 on delete error', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: createChainableQuery(null, { message: 'Cannot delete' }) as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/automation-rules/rule-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request, makeParams('rule-1'));
    expect(response.status).toBe(400);
  });
});
