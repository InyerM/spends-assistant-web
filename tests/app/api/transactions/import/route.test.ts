import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/transactions/import/route';
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

interface TableConfig {
  maybeSingle?: { data: unknown; error: unknown };
  single?: { data: unknown; error: unknown };
  thenable?: { data: unknown; error: unknown };
}

function createChain(config: TableConfig = {}) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  ['select', 'eq', 'is', 'in', 'insert', 'update'].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.maybeSingle = vi.fn().mockResolvedValue(config.maybeSingle ?? { data: null, error: null });
  chain.single = vi.fn().mockResolvedValue(config.single ?? { data: null, error: null });
  if (config.thenable) {
    Object.defineProperty(chain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve(config.thenable),
      enumerable: false,
      configurable: true,
    });
  }
  return chain;
}

function createSupabaseMock(tables: Partial<Record<string, TableConfig>> = {}) {
  const defaultChain = createChain();
  return {
    from: vi.fn((table: string) => {
      const config = tables[table];
      if (config) return createChain(config);
      return defaultChain;
    }),
  };
}

describe('POST /api/transactions/import', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('imports transactions directly', async () => {
    const { getUserClient } = await import('@/lib/api/server');

    const supabase = createSupabaseMock({
      imports: { single: { data: { id: 'import-1' }, error: null } },
      transactions: { thenable: { data: [{ id: 'tx-1' }, { id: 'tx-2' }], error: null } },
    });

    vi.mocked(getUserClient).mockResolvedValue({
      supabase: supabase as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/transactions/import', {
      method: 'POST',
      body: JSON.stringify({
        transactions: [
          {
            date: '2024-01-15',
            time: '14:30',
            amount: 50000,
            description: 'Test',
            type: 'expense',
            account: 'Checking',
            source: 'import',
          },
          {
            date: '2024-01-16',
            time: '10:00',
            amount: 30000,
            description: 'Test 2',
            type: 'expense',
            account: 'Checking',
            source: 'import',
          },
        ],
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.imported).toBe(2);
    expect(body.skipped).toBe(0);
  });

  it('returns 400 when no transactions provided', async () => {
    const { getUserClient } = await import('@/lib/api/server');

    vi.mocked(getUserClient).mockResolvedValue({
      supabase: createSupabaseMock() as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/transactions/import', {
      method: 'POST',
      body: JSON.stringify({ transactions: [] }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('resolves names when resolve_names is true', async () => {
    const { getUserClient } = await import('@/lib/api/server');

    const supabase = createSupabaseMock({
      imports: { single: { data: { id: 'import-1' }, error: null } },
      accounts: { thenable: { data: [{ id: 'acc-1', name: 'Checking' }], error: null } },
      categories: { thenable: { data: [{ id: 'cat-1', name: 'Food' }], error: null } },
      transactions: { thenable: { data: [{ id: 'tx-1' }], error: null } },
    });

    vi.mocked(getUserClient).mockResolvedValue({
      supabase: supabase as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/transactions/import', {
      method: 'POST',
      body: JSON.stringify({
        resolve_names: true,
        transactions: [
          {
            date: '2024-01-15',
            time: '14:30',
            amount: 50000,
            description: 'Lunch',
            type: 'expense',
            account: 'Checking',
            category: 'Food',
            source: 'import',
            notes: null,
            payment_method: null,
          },
        ],
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.imported).toBe(1);
  });

  it('returns error when all accounts unresolved', async () => {
    const { getUserClient } = await import('@/lib/api/server');

    const supabase = createSupabaseMock({
      imports: { single: { data: { id: 'import-1' }, error: null } },
      accounts: { thenable: { data: [], error: null } },
      categories: { thenable: { data: [], error: null } },
    });

    vi.mocked(getUserClient).mockResolvedValue({
      supabase: supabase as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/transactions/import', {
      method: 'POST',
      body: JSON.stringify({
        resolve_names: true,
        transactions: [
          {
            date: '2024-01-15',
            time: '14:30',
            amount: 50000,
            description: 'Test',
            type: 'expense',
            account: 'Unknown',
            category: null,
            source: 'import',
            notes: null,
            payment_method: null,
          },
        ],
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 on DB insert error', async () => {
    const { getUserClient } = await import('@/lib/api/server');

    const supabase = createSupabaseMock({
      imports: { single: { data: { id: 'import-1' }, error: null } },
      transactions: { thenable: { data: null, error: { message: 'Insert failed' } } },
    });

    vi.mocked(getUserClient).mockResolvedValue({
      supabase: supabase as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/transactions/import', {
      method: 'POST',
      body: JSON.stringify({
        transactions: [
          {
            date: '2024-01-15',
            time: '14:30',
            amount: 50000,
            description: 'Test',
            type: 'expense',
            account: 'Checking',
            source: 'import',
          },
        ],
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
