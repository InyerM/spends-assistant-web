import { afterEach, it, expect, vi } from 'vitest';
import { dispatchInboxAnalysis } from '@/lib/shortcut-inbox/analysis-dispatch';
vi.mock('@/lib/config', () => ({
  workerConfig: { url: 'https://worker.example', apiKey: 'must-not-be-used' },
}));
afterEach(() => vi.unstubAllGlobals());
it('forwards only received IDs with the incoming owner credential, no raw text or static key', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ state: 'pending' }));
  vi.stubGlobal('fetch', fetcher);
  const supabase = { auth: { getSession: vi.fn() } };
  await dispatchInboxAnalysis(
    new Request('https://web.example', { headers: { Authorization: 'Bearer sk_owner' } }),
    supabase as never,
    [
      { index: 0, status: 'received', id: 'first' },
      { index: 1, status: 'invalid' },
      { index: 2, status: 'previously_received', id: 'old' },
    ],
  );
  expect(fetcher).toHaveBeenCalledExactlyOnceWith(
    'https://worker.example/inbox/analysis-dispatch',
    expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer sk_owner' },
      body: JSON.stringify({ inbox_item_ids: ['first'] }),
    }),
  );
  expect(supabase.auth.getSession).not.toHaveBeenCalled();
});
it('uses cookie session JWT and chunks at 25 without waiting for AI', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ state: 'pending' })));
  const supabase = {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'cookie' } } }),
    },
  };
  await dispatchInboxAnalysis(
    new Request('https://web.example'),
    supabase as never,
    Array.from({ length: 26 }, (_, index) => ({
      index,
      status: 'received' as const,
      id: `id-${index}`,
    })),
  );
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string).inbox_item_ids).toHaveLength(
    25,
  );
  expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toMatchObject({
    Authorization: 'Bearer cookie',
  });
});
it('does no network work without new IDs and tolerates dispatcher outage after durable intake', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  const supabase = { auth: { getSession: vi.fn() } };
  await dispatchInboxAnalysis(new Request('https://web.example'), supabase as never, []);
  expect(fetch).not.toHaveBeenCalled();
  await expect(
    dispatchInboxAnalysis(
      new Request('https://web.example', { headers: { Authorization: 'Bearer sk_owner' } }),
      supabase as never,
      [{ index: 0, status: 'received', id: 'id' }],
    ),
  ).resolves.toBeUndefined();
});
