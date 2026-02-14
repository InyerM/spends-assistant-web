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

describe('POST /api/transactions/parse', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parses text and returns result with automation rules', async () => {
    const { getUserClient, applyAutomationRules } = await import('@/lib/api/server');

    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    ['select', 'eq', 'is', 'order'].forEach((m) => {
      chain[m] = vi.fn().mockReturnValue(chain);
    });
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: { from: vi.fn().mockReturnValue(chain) } as never,
      userId: 'test-user-id',
    });
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
      body: JSON.stringify({ text: '' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 when text is missing', async () => {
    const request = new NextRequest('http://localhost/api/transactions/parse', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
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
      body: JSON.stringify({ text: 'something' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});
