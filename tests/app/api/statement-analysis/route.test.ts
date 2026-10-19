import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/api/server', () => ({
  getUserClient: vi.fn(),
  applyAutomationRules: vi.fn(),
  AuthError: class extends Error {},
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));
vi.mock('@/lib/config', () => ({ workerConfig: { url: 'https://worker.test' } }));
import { getUserClient, applyAutomationRules } from '@/lib/api/server';
import { POST } from '@/app/api/documents/[id]/observations/[observationId]/analyze/route';
const id = '10000000-0000-4000-8000-000000000001';
beforeEach(() => {
  vi.clearAllMocks();
  const values: Record<string, unknown> = {
    documents: { document_type: 'statement', status: 'extracted' },
    document_observations: {
      id,
      amount: -100,
      currency: 'USD',
      occurred_at_text: '2026-09-01',
      description: 'Cafe',
      source_excerpt: '01/09 Cafe 100',
      status: 'pending',
    },
    categories: { id, type: 'expense' },
  };
  vi.mocked(getUserClient).mockResolvedValue({
    userId: 'owner',
    accessToken: 'test-token',
    supabase: {
      from: (table: string) => {
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: values[table], error: null }),
        };
        return chain;
      },
    } as never,
  });
  vi.mocked(applyAutomationRules).mockImplementation(async (_client, input) => input);
});
it('only proposes description and a validated category, leaving verified amounts and dates untouched', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    Response.json({
      parsed: { description: 'Coffee', amount: 99999 },
      resolved: { category_id: id },
    }),
  );
  vi.stubGlobal('fetch', fetcher);
  const response = await POST(new Request('https://my.anotto.app', { method: 'POST' }), {
    params: Promise.resolve({ id, observationId: id }),
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ category_id: id, description: 'Coffee', source: 'ai' });
  expect(JSON.parse(fetcher.mock.calls[0][1].body as string).text).toContain('Currency: USD');
  vi.unstubAllGlobals();
});
