import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/transactions/route';
import { NextRequest } from 'next/server';

// Mock server utilities
vi.mock('@/lib/api/server', () => ({
  getAdminClient: vi.fn(),
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
    const { getAdminClient } = await import('@/lib/api/server');
    const mockSb = createChainableQuery([{ id: 'tx-1' }, { id: 'tx-2' }]);
    vi.mocked(getAdminClient).mockReturnValue(mockSb as never);

    const request = new NextRequest('http://localhost/api/transactions?page=1&limit=20');
    const response = await GET(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(2);
  });

  it('filters by type', async () => {
    const { getAdminClient } = await import('@/lib/api/server');
    const mockSb = createChainableQuery([]);
    vi.mocked(getAdminClient).mockReturnValue(mockSb as never);

    const request = new NextRequest('http://localhost/api/transactions?type=expense');
    await GET(request);
    expect(mockSb._chain.eq).toHaveBeenCalledWith('type', 'expense');
  });

  it('filters by types (comma-separated)', async () => {
    const { getAdminClient } = await import('@/lib/api/server');
    const mockSb = createChainableQuery([]);
    vi.mocked(getAdminClient).mockReturnValue(mockSb as never);

    const request = new NextRequest('http://localhost/api/transactions?types=expense,income');
    await GET(request);
    expect(mockSb._chain.in).toHaveBeenCalledWith('type', ['expense', 'income']);
  });

  it('filters by date range', async () => {
    const { getAdminClient } = await import('@/lib/api/server');
    const mockSb = createChainableQuery([]);
    vi.mocked(getAdminClient).mockReturnValue(mockSb as never);

    const request = new NextRequest(
      'http://localhost/api/transactions?date_from=2024-01-01&date_to=2024-01-31',
    );
    await GET(request);
    expect(mockSb._chain.gte).toHaveBeenCalledWith('date', '2024-01-01');
    expect(mockSb._chain.lte).toHaveBeenCalledWith('date', '2024-01-31');
  });

  it('filters by search', async () => {
    const { getAdminClient } = await import('@/lib/api/server');
    const mockSb = createChainableQuery([]);
    vi.mocked(getAdminClient).mockReturnValue(mockSb as never);

    const request = new NextRequest('http://localhost/api/transactions?search=restaurante');
    await GET(request);
    expect(mockSb._chain.ilike).toHaveBeenCalledWith('description', '%restaurante%');
  });

  it('sorts by amount', async () => {
    const { getAdminClient } = await import('@/lib/api/server');
    const mockSb = createChainableQuery([]);
    vi.mocked(getAdminClient).mockReturnValue(mockSb as never);

    const request = new NextRequest(
      'http://localhost/api/transactions?sort_by=amount&sort_order=asc',
    );
    await GET(request);
    expect(mockSb._chain.order).toHaveBeenCalledWith('amount', { ascending: true });
  });

  it('returns error when query fails', async () => {
    const { getAdminClient } = await import('@/lib/api/server');
    const mockSb = createChainableQuery(null, { message: 'DB error' });
    vi.mocked(getAdminClient).mockReturnValue(mockSb as never);

    const request = new NextRequest('http://localhost/api/transactions');
    const response = await GET(request);
    expect(response.status).toBe(400);
  });
});

describe('POST /api/transactions', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
  });

  it('creates a transaction', async () => {
    const { getAdminClient, applyTransactionBalance } = await import('@/lib/api/server');
    const tx = {
      id: 'tx-new',
      type: 'expense',
      amount: 50000,
      account_id: 'acc-1',
      transfer_to_account_id: null,
    };

    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    ['select', 'eq', 'is', 'in', 'order', 'limit', 'insert', 'update'].forEach((m) => {
      chain[m] = vi.fn().mockReturnValue(chain);
    });
    chain.single = vi.fn().mockResolvedValue({ data: tx, error: null });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

    const mockSb = { from: vi.fn().mockReturnValue(chain) };
    vi.mocked(getAdminClient).mockReturnValue(mockSb as never);
    vi.mocked(applyTransactionBalance).mockResolvedValue();

    const request = new NextRequest('http://localhost/api/transactions', {
      method: 'POST',
      body: JSON.stringify({
        date: '2024-01-15',
        time: '14:30',
        amount: 50000,
        description: 'Test',
        account_id: 'acc-1',
        type: 'expense',
        source: 'api',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
  });

  it('returns 409 for duplicate', async () => {
    const { getAdminClient } = await import('@/lib/api/server');
    const existingTx = { id: 'tx-existing' };

    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    ['select', 'eq', 'is', 'in', 'order', 'limit', 'insert', 'update'].forEach((m) => {
      chain[m] = vi.fn().mockReturnValue(chain);
    });
    chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
    // maybeSingle returns existing tx (exact match)
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: existingTx, error: null });

    const mockSb = { from: vi.fn().mockReturnValue(chain) };
    vi.mocked(getAdminClient).mockReturnValue(mockSb as never);

    const request = new NextRequest('http://localhost/api/transactions', {
      method: 'POST',
      body: JSON.stringify({
        date: '2024-01-15',
        time: '14:30',
        amount: 50000,
        description: 'Test',
        account_id: 'acc-1',
        type: 'expense',
        source: 'api',
        raw_text: 'Compraste $50,000',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.duplicate).toBe(true);
  });

  it('skips duplicate check with force=true', async () => {
    const { getAdminClient, applyTransactionBalance } = await import('@/lib/api/server');
    const tx = {
      id: 'tx-new',
      type: 'expense',
      amount: 50000,
      account_id: 'acc-1',
      transfer_to_account_id: null,
    };

    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    ['select', 'eq', 'is', 'in', 'order', 'limit', 'insert', 'update'].forEach((m) => {
      chain[m] = vi.fn().mockReturnValue(chain);
    });
    chain.single = vi.fn().mockResolvedValue({ data: tx, error: null });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

    const mockSb = { from: vi.fn().mockReturnValue(chain) };
    vi.mocked(getAdminClient).mockReturnValue(mockSb as never);
    vi.mocked(applyTransactionBalance).mockResolvedValue();

    const request = new NextRequest('http://localhost/api/transactions?force=true', {
      method: 'POST',
      body: JSON.stringify({
        date: '2024-01-15',
        time: '14:30',
        amount: 50000,
        description: 'Test',
        account_id: 'acc-1',
        type: 'expense',
        source: 'api',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    // maybeSingle should not have been called (no duplicate check)
    expect(chain.maybeSingle).not.toHaveBeenCalled();
  });

  it('replaces existing transaction when replace param provided', async () => {
    const { getAdminClient, applyTransactionBalance } = await import('@/lib/api/server');
    const original = {
      type: 'expense',
      amount: 30000,
      account_id: 'acc-1',
      transfer_to_account_id: null,
    };
    const newTx = {
      id: 'tx-new',
      type: 'expense',
      amount: 50000,
      account_id: 'acc-1',
      transfer_to_account_id: null,
    };

    let singleCallCount = 0;
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    ['select', 'eq', 'is', 'in', 'order', 'limit', 'insert', 'update'].forEach((m) => {
      chain[m] = vi.fn().mockReturnValue(chain);
    });
    chain.single = vi.fn().mockImplementation(async () => {
      singleCallCount++;
      if (singleCallCount === 1) return { data: original, error: null }; // fetch original
      return { data: newTx, error: null }; // insert new
    });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

    const mockSb = { from: vi.fn().mockReturnValue(chain) };
    vi.mocked(getAdminClient).mockReturnValue(mockSb as never);
    vi.mocked(applyTransactionBalance).mockResolvedValue();

    const request = new NextRequest('http://localhost/api/transactions?replace=old-tx-id', {
      method: 'POST',
      body: JSON.stringify({
        date: '2024-01-15',
        time: '14:30',
        amount: 50000,
        description: 'Test',
        account_id: 'acc-1',
        type: 'expense',
        source: 'api',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    // applyTransactionBalance should be called with reverse=true for old tx
    expect(applyTransactionBalance).toHaveBeenCalled();
  });
});
