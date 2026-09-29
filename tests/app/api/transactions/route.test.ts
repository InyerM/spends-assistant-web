import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/transactions/route';
import { NextRequest } from 'next/server';

// Mock server utilities
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
  applyTransactionBalance: vi.fn(),
  applyAutomationRules: vi.fn((_, tx) => Promise.resolve(tx)),
}));

function createChainableQuery(data: unknown, error: { message: string } | null = null) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    'select',
    'eq',
    'is',
    'in',
    'gte',
    'lte',
    'ilike',
    'order',
    'range',
    'limit',
    'insert',
    'update',
  ] as const;
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue({ data, error });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

  // Make chain thenable for queries without .single()
  Object.defineProperty(chain, 'then', {
    value: (resolve: (v: unknown) => void) =>
      resolve({
        data: Array.isArray(data) ? data : data ? [data] : [],
        error,
        count: Array.isArray(data) ? data.length : data ? 1 : 0,
      }),
    enumerable: false,
    configurable: true,
  });

  return { from: vi.fn().mockReturnValue(chain), _chain: chain };
}

describe('GET /api/transactions', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
  });

  it('returns paginated transactions', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const mockSb = createChainableQuery([{ id: 'tx-1' }, { id: 'tx-2' }]);
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: mockSb as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/transactions?page=1&limit=20');
    const response = await GET(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(2);
  });

  it('filters by type', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const mockSb = createChainableQuery([]);
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: mockSb as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/transactions?type=expense');
    await GET(request);
    expect(mockSb._chain.eq).toHaveBeenCalledWith('type', 'expense');
  });

  it('filters by types (comma-separated)', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const mockSb = createChainableQuery([]);
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: mockSb as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/transactions?types=expense,income');
    await GET(request);
    expect(mockSb._chain.in).toHaveBeenCalledWith('type', ['expense', 'income']);
  });

  it('filters by date range', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const mockSb = createChainableQuery([]);
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: mockSb as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest(
      'http://localhost/api/transactions?date_from=2024-01-01&date_to=2024-01-31',
    );
    await GET(request);
    expect(mockSb._chain.gte).toHaveBeenCalledWith('date', '2024-01-01');
    expect(mockSb._chain.lte).toHaveBeenCalledWith('date', '2024-01-31');
  });

  it('filters by search', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const mockSb = createChainableQuery([]);
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: mockSb as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/transactions?search=restaurante');
    await GET(request);
    expect(mockSb._chain.ilike).toHaveBeenCalledWith('description', '%restaurante%');
  });

  it('sorts by amount', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const mockSb = createChainableQuery([]);
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: mockSb as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest(
      'http://localhost/api/transactions?sort_by=amount&sort_order=asc',
    );
    await GET(request);
    expect(mockSb._chain.order).toHaveBeenCalledWith('amount', { ascending: true });
  });

  it('returns error when query fails', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const mockSb = createChainableQuery(null, { message: 'DB error' });
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: mockSb as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/transactions');
    const response = await GET(request);
    expect(response.status).toBe(400);
  });
});
