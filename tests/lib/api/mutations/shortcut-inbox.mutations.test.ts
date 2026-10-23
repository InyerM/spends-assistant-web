import { afterEach, it, expect, vi } from 'vitest';
import { analyzeForwardedEmail } from '@/lib/api/mutations/shortcut-inbox.mutations';
afterEach(() => vi.unstubAllGlobals());
it('uses the ready server cache by default when the local list has not caught up', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(Response.json({ status: 'needs_review', description: 'Cached' })),
  );
  await analyzeForwardedEmail('item');
  expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)).toEqual({ refresh: false });
});
it('refreshes only on an explicit reviewed user action', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(Response.json({ state: 'running' }, { status: 202 })),
  );
  expect(await analyzeForwardedEmail({ id: 'item', refresh: true })).toEqual({ state: 'running' });
  expect(vi.mocked(fetch)).toHaveBeenCalledWith(
    '/api/shortcut-inbox/item/analyze',
    expect.objectContaining({ body: JSON.stringify({ refresh: true }) }),
  );
});
