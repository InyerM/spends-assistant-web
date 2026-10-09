import { afterEach, expect, it, vi } from 'vitest';
import { fetchPendingDocumentCount } from '@/lib/api/queries/document-pending.queries';
afterEach(() => vi.unstubAllGlobals());
it('distinguishes an empty pending queue from a failed count lookup', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ count: 0 }))
    .mockResolvedValueOnce(Response.json({ error: 'unavailable' }, { status: 503 }));
  vi.stubGlobal('fetch', request);
  const controller = new AbortController();
  expect(await fetchPendingDocumentCount(controller.signal)).toBe(0);
  expect(request).toHaveBeenCalledWith(
    '/api/documents/pending-count',
    expect.objectContaining({ signal: controller.signal, cache: 'no-store' }),
  );
  await expect(fetchPendingDocumentCount()).rejects.toThrow('Could not load pending documents');
});
