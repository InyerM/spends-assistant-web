import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/transactions/import/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server', () => ({
  getAdminClient: vi.fn(),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (message: string, status = 500) => Response.json({ error: message }, { status }),
}));

function createImportChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  ['select', 'eq', 'is', 'in', 'insert', 'update'].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  return chain;
}

describe('POST /api/transactions/import', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('imports transactions directly', async () => {
    const { getAdminClient } = await import('@/lib/api/server');
    const chain = createImportChain();

    Object.defineProperty(chain, 'then', {
      value: (resolve: (v: unknown) => void) =>
        resolve({ data: [{ id: 'tx-1' }, { id: 'tx-2' }], error: null }),
      enumerable: false,
      configurable: true,
    });

    vi.mocked(getAdminClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as never);

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
    const request = new NextRequest('http://localhost/api/transactions/import', {
      method: 'POST',
      body: JSON.stringify({ transactions: [] }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('resolves names when resolve_names is true', async () => {
    const { getAdminClient } = await import('@/lib/api/server');
    const chain = createImportChain();

    let thenCallCount = 0;
    Object.defineProperty(chain, 'then', {
      value: (resolve: (v: unknown) => void) => {
        thenCallCount++;
        // Accounts lookup
        if (thenCallCount === 1)
          return resolve({ data: [{ id: 'acc-1', name: 'Checking' }], error: null });
        // Categories lookup
        if (thenCallCount === 2)
          return resolve({ data: [{ id: 'cat-1', name: 'Food' }], error: null });
        // Insert
        return resolve({ data: [{ id: 'tx-1' }], error: null });
      },
      enumerable: false,
      configurable: true,
    });

    vi.mocked(getAdminClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as never);

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
    const { getAdminClient } = await import('@/lib/api/server');
    const chain = createImportChain();

    let thenCallCount = 0;
    Object.defineProperty(chain, 'then', {
      value: (resolve: (v: unknown) => void) => {
        thenCallCount++;
        if (thenCallCount === 1) return resolve({ data: [], error: null });
        if (thenCallCount === 2) return resolve({ data: [], error: null });
        return resolve({ data: [], error: null });
      },
      enumerable: false,
      configurable: true,
    });

    vi.mocked(getAdminClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as never);

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
    const { getAdminClient } = await import('@/lib/api/server');
    const chain = createImportChain();

    Object.defineProperty(chain, 'then', {
      value: (resolve: (v: unknown) => void) =>
        resolve({ data: null, error: { message: 'Insert failed' } }),
      enumerable: false,
      configurable: true,
    });

    vi.mocked(getAdminClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as never);

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
