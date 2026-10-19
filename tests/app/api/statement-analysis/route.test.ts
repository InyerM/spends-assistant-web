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
let tableValues: Record<string, unknown>;
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
    categories: { id, type: 'expense', slug: 'restaurant' },
    accounts: { id, type: 'credit_card' },
    statement_currency_scopes: { account_id: id },
    statement_reconciliation_scopes: { account_id: id },
  };
  tableValues = values;
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
it('returns a review state instead of an income category for an unidentified card repayment', async () => {
  const movement = tableValues.document_observations as { amount: number; description: string };
  movement.amount = 5;
  movement.description = 'ABONO SUCURSAL VIRTUAL';
  const { isCardPayment } = await import('@/lib/category-review');
  expect(isCardPayment('credit_card', 'ABONO SUCURSAL VIRTUAL')).toBe(true);
  const fetcher = vi.fn().mockResolvedValue(
    Response.json({
      category_id: null,
      description: 'Card payment',
      notes: '',
      explanation: 'Confirm the source account.',
      kind: 'own_transfer',
      evidence_ids: [],
    }),
  );
  vi.stubGlobal('fetch', fetcher);
  const response = await POST(
    new Request('https://my.anotto.app', {
      method: 'POST',
      body: JSON.stringify({ locale: 'es', account_id: id }),
    }),
    { params: Promise.resolve({ id, observationId: id }) },
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    kind: 'own_transfer',
    category_id: null,
    reason_code: 'card_payment',
    source: 'evidence',
  });
  expect(fetcher.mock.calls[0][0]).toBe('https://worker.test/category/review');
  vi.unstubAllGlobals();
});
it('only proposes description and a validated category, leaving verified amounts and dates untouched', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    Response.json({
      description: 'Coffee',
      category_id: id,
      notes: '',
      explanation: 'Coffee merchant supports Restaurants.',
      kind: 'expense',
      evidence_ids: [],
    }),
  );
  vi.stubGlobal('fetch', fetcher);
  const response = await POST(new Request('https://my.anotto.app', { method: 'POST' }), {
    params: Promise.resolve({ id, observationId: id }),
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    category_id: id,
    description: 'Coffee',
    source: 'ai',
    explanation: 'Coffee merchant supports Restaurants.',
  });
  expect(JSON.parse(fetcher.mock.calls[0][1].body as string).account_type).toBe('credit_card');
  vi.unstubAllGlobals();
});
