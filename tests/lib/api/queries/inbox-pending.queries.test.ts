import { afterEach, expect, it, vi } from 'vitest';
import { fetchPendingInboxCount } from '@/lib/api/queries/inbox-pending.queries';
afterEach(() => vi.unstubAllGlobals());
it('distinguishes an empty pending queue from a failed count lookup', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ count: 0 }))
    .mockResolvedValueOnce(Response.json({ error: 'unavailable' }, { status: 503 }));
  vi.stubGlobal('fetch', request);
  const controller = new AbortController();
  expect(await fetchPendingInboxCount(controller.signal)).toBe(0);
  expect(request).toHaveBeenCalledWith(
    '/api/shortcut-inbox/pending-count',
    expect.objectContaining({ signal: controller.signal, cache: 'no-store' }),
  );
  await expect(fetchPendingInboxCount()).rejects.toThrow('Could not load pending reviews');
});
