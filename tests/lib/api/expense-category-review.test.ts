import { afterEach, expect, it, vi } from 'vitest';
import { analyzeExpenseCategories } from '@/lib/api/mutations/expense-category-review.mutations';
afterEach(() => vi.unstubAllGlobals());
it('analyzes selected expenses independently with bounded concurrency and no financial writes', async () => {
  let active = 0,
    max = 0;
  const fetch = vi.fn(async (_url: string, init: RequestInit) => {
    active++;
    max = Math.max(max, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active--;
    expect(init.method).toBe('POST');
    return Response.json({
      category_id: 'streaming',
      description: 'Subscription',
      notes: '',
      kind: 'expense',
      explanation: 'Video subscription',
      evidence_ids: [],
    });
  });
  vi.stubGlobal('fetch', fetch);
  const results = await analyzeExpenseCategories({
    ids: ['youtube', 'spotify', 'restaurant', 'groceries', 'transport'],
    locale: 'es',
  });
  expect(max).toBe(2);
  expect(results).toHaveLength(5);
  expect(results.every((r) => r.proposal?.category_id === 'streaming')).toBe(true);
  expect(fetch.mock.calls.every(([url]) => url.endsWith('/analyze'))).toBe(true);
  await expect(
    analyzeExpenseCategories({ ids: Array.from({ length: 6 }, (_, i) => String(i)), locale: 'es' }),
  ).rejects.toThrow('Invalid review selection');
});
it('retains successful proposals and stops further batches when quota is exhausted', async () => {
  const fetch = vi.fn(async (url: string) =>
    url.includes('/second/')
      ? Response.json({ error: 'Limit' }, { status: 429 })
      : Response.json({
          category_id: null,
          description: 'Unknown',
          notes: '',
          explanation: 'Insufficient evidence',
          kind: 'unknown',
          evidence_ids: [],
        }),
  );
  vi.stubGlobal('fetch', fetch);
  const results = await analyzeExpenseCategories({
    ids: ['first', 'second', 'third', 'fourth'],
    locale: 'es',
  });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(results[0].proposal?.explanation).toBe('Insufficient evidence');
  expect(results.slice(1).every((r) => r.error)).toBe(true);
});
