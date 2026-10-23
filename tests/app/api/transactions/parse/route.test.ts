import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/transactions/parse/route';
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
  applyAutomationRules: vi.fn((_, tx) => Promise.resolve(tx)),
}));

vi.mock('@/lib/config', () => ({
  workerConfig: {
    url: 'http://worker.test',
    apiKey: 'test-key',
  },
}));

function createMockSupabaseWithSession(): unknown {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-supabase-jwt' } },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    }),
  };
}

describe('POST /api/transactions/parse', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    const { getUserClient } = await import('@/lib/api/server');
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: createMockSupabaseWithSession() as never,
      userId: 'test-user-id',
    });
  });

  it('parses text and returns result with automation rules', async () => {
    const { applyAutomationRules } = await import('@/lib/api/server');

    vi.mocked(applyAutomationRules).mockResolvedValue({
      description: 'Almuerzo',
      amount: 15000,
      account_id: 'acc-1',
      source: 'manual',
      type: 'expense',
      category_id: 'cat-food',
      applied_rules: [{ rule_id: 'r1', rule_name: 'Food' }],
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              parsed: {
                amount: 15000,
                description: 'Almuerzo',
                category: 'food',
                source: 'manual',
                confidence: 0.9,
              },
              resolved: {
                account_id: 'acc-1',
                category_id: 'cat-food',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const request = new NextRequest('http://localhost/api/transactions/parse', {
      method: 'POST',
      headers: { Origin: 'http://localhost' },
      body: JSON.stringify({ text: 'Almuerzo 15000' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.parsed.amount).toBe(15000);
    expect(body.applied_rules).toHaveLength(1);
  });

  it('returns 400 when text is empty', async () => {
    const request = new NextRequest('http://localhost/api/transactions/parse', {
      method: 'POST',
      headers: { Origin: 'http://localhost' },
      body: JSON.stringify({ text: '' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 when text is missing', async () => {
    const request = new NextRequest('http://localhost/api/transactions/parse', {
      method: 'POST',
      headers: { Origin: 'http://localhost' },
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('forwards a required financial text consent instead of a generic parse failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { code: 'AI_CONSENT_REQUIRED', scope: 'financial_text', version: 'external-ai-v1' },
            { status: 428 },
          ),
        ),
    );
    const response = await POST(
      new NextRequest('http://localhost/api/transactions/parse', {
        method: 'POST',
        headers: { Origin: 'http://localhost' },
        body: JSON.stringify({ text: 'Coffee 10000' }),
      }),
    );
    expect(response.status).toBe(428);
    expect(await response.json()).toMatchObject({
      code: 'AI_CONSENT_REQUIRED',
      scope: 'financial_text',
    });
  });

  it('returns error when worker fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'Parse error' }), {
            status: 422,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    const request = new NextRequest('http://localhost/api/transactions/parse', {
      method: 'POST',
      headers: { Origin: 'http://localhost' },
      body: JSON.stringify({ text: 'something' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(422);
  });

  it('handles worker returning non-JSON error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('Internal Server Error', {
            status: 500,
            headers: { 'Content-Type': 'text/plain' },
          }),
      ),
    );

    const request = new NextRequest('http://localhost/api/transactions/parse', {
      method: 'POST',
      headers: { Origin: 'http://localhost' },
      body: JSON.stringify({ text: 'something' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});

it('preserves validated purpose notes and lets automation append instead of replace them for Bearer callers', async () => {
  const { getUserClient, applyAutomationRules } = await import('@/lib/api/server');
  const getSession = vi.fn();
  vi.mocked(getUserClient).mockResolvedValue({
    supabase: { auth: { getSession } } as never,
    userId: 'owner',
    accessToken: 'native-jwt',
  });
  vi.mocked(applyAutomationRules).mockImplementation(async (_client, tx) => ({
    ...tx,
    notes: `${tx.notes}\nRule note`,
  }));
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      Response.json({
        parsed: { amount: 4200, description: 'Purchase', source: 'manual', confidence: 1 },
        resolved: { notes: 'Current-source purpose' },
      }),
    ),
  );
  const request = new NextRequest('https://web.example/api/transactions/parse', {
    method: 'POST',
    headers: { Authorization: 'Bearer native-jwt' },
    body: JSON.stringify({ text: 'Purchase 4200 for current-source purpose' }),
  });
  const response = await POST(request);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    resolved: { notes: 'Current-source purpose\nRule note' },
  });
  expect(getUserClient).toHaveBeenCalledWith(request);
  expect(getSession).not.toHaveBeenCalled();
});

it.each([null, [], { text: 4 }, { text: 'x'.repeat(16385) }])(
  'rejects invalid or unbounded parse input before Worker calls: %s',
  async (body) => {
    const { getUserClient } = await import('@/lib/api/server');
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: createMockSupabaseWithSession() as never,
      userId: 'owner',
    });
    vi.stubGlobal('fetch', vi.fn());
    expect(
      (
        await POST(
          new NextRequest('https://web.example/api/transactions/parse', {
            method: 'POST',
            headers: { Origin: 'https://web.example' },
            body: JSON.stringify(body),
          }),
        )
      ).status,
    ).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  },
);

it('rejects cross-origin cookie parse before session reads or external AI', async () => {
  const { getUserClient } = await import('@/lib/api/server');
  const getSession = vi.fn();
  vi.mocked(getUserClient).mockResolvedValue({
    supabase: { auth: { getSession } } as never,
    userId: 'owner',
  });
  vi.stubGlobal('fetch', vi.fn());
  const response = await POST(
    new NextRequest('https://web.example/api/transactions/parse', {
      method: 'POST',
      headers: { Origin: 'https://evil.example' },
      body: JSON.stringify({ text: 'Synthetic purchase 4200' }),
    }),
  );
  expect(response.status).toBe(403);
  expect(getSession).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
