import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/automation-rules/route';
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

describe('GET /api/automation-rules', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns list of rules ordered by priority', async () => {
    const { getAdminClient } = await import('@/lib/api/server');
    const rules = [
      { id: 'rule-1', name: 'Rule 1', priority: 10 },
      { id: 'rule-2', name: 'Rule 2', priority: 5 },
    ];
    const mock = createChainableQuery(rules);
    vi.mocked(getAdminClient).mockReturnValue(mock as never);

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

describe('POST /api/automation-rules', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an automation rule', async () => {
    const { getAdminClient } = await import('@/lib/api/server');
    const rule = { id: 'rule-new', name: 'New Rule' };
    vi.mocked(getAdminClient).mockReturnValue(createChainableQuery(rule) as never);

    const request = new NextRequest('http://localhost/api/automation-rules', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Rule', conditions: {}, actions: {} }),
    });
    const response = await POST(request);
    expect(response.status).toBe(201);
  });

  it('returns 400 on create error', async () => {
    const { getAdminClient } = await import('@/lib/api/server');
    vi.mocked(getAdminClient).mockReturnValue(
      createChainableQuery(null, { message: 'Insert failed' }) as never,
    );

    const request = new NextRequest('http://localhost/api/automation-rules', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bad' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
