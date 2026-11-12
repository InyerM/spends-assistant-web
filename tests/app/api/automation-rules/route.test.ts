import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/automation-rules/route';
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
  ['select', 'eq', 'is', 'order', 'insert', 'range'].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.single = vi.fn().mockResolvedValue({ data, error });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

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

describe('GET /api/automation-rules', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns list of rules ordered by priority', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const rules = [
      { id: 'rule-1', name: 'Rule 1', priority: 10 },
      { id: 'rule-2', name: 'Rule 2', priority: 5 },
    ];
    const mock = createChainableQuery(rules);
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: mock as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/automation-rules');
    const response = await GET(request);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: unknown[]; count: number };
    expect(body.data).toHaveLength(2);
  });

  it('returns 400 on error', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: createChainableQuery(null, { message: 'DB error' }) as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/automation-rules');
    const response = await GET(request);
    expect(response.status).toBe(400);
  });
});

describe('POST /api/automation-rules', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an automation rule', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const rule = { id: 'rule-new', name: 'New Rule' };
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: createChainableQuery(rule) as never,
      userId: 'test-user-id',
    });

    const request = new NextRequest('http://localhost/api/automation-rules', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Rule', conditions: {}, actions: {} }),
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

    const request = new NextRequest('http://localhost/api/automation-rules', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bad' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});

describe('bounded expression validation', () => {
  it.each([false, true])(
    'rejects unsupported expressions before inserting any rule (bulk=%s)',
    async (bulk) => {
      const { getUserClient } = await import('@/lib/api/server');
      const mock = createChainableQuery([]);
      vi.mocked(getUserClient).mockResolvedValue({ supabase: mock as never, userId: 'owner' });
      const rule = { name: 'Synthetic', conditions: { description_regex: '(?=a)a' }, actions: {} };
      const response = await POST(
        new NextRequest('https://example.test/api/automation-rules', {
          method: 'POST',
          headers: { Origin: 'https://example.test', 'Content-Type': 'application/json' },
          body: JSON.stringify(bulk ? [{ name: 'Safe', conditions: {}, actions: {} }, rule] : rule),
        }),
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: 'AUTOMATION_REGEX_REVIEW_REQUIRED' });
      expect(mock._chain.insert).not.toHaveBeenCalled();
    },
  );
});

it('exposes review metadata without rewriting an existing unsupported expression', async () => {
  const { getUserClient } = await import('@/lib/api/server');
  const rule = { id: 'synthetic', conditions: { description_regex: '(?=a)a' } };
  const mock = createChainableQuery([rule]);
  vi.mocked(getUserClient).mockResolvedValue({ supabase: mock as never, userId: 'owner' });
  const response = await GET(new NextRequest('https://example.test/api/automation-rules'));
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.data[0].matching_compatibility).toMatchObject({ requires_review: true });
  expect(body.data[0].conditions).toEqual(rule.conditions);
  expect(mock._chain.insert).not.toHaveBeenCalled();
});
