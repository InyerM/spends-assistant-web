import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchNotifications, markNotificationsRead } from '@/lib/api/queries/notifications.queries';
afterEach(() => vi.unstubAllGlobals());
describe('notification transport', () => {
  it('uses private cancellable reads', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ data: [], unread_count: 0 }));
    vi.stubGlobal('fetch', fetcher);
    const signal = new AbortController().signal;
    await fetchNotifications(signal);
    expect(fetcher).toHaveBeenCalledWith('/api/notifications', { cache: 'no-store', signal });
  });
  it('marks one notice without changing financial review state', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ updated: true }));
    vi.stubGlobal('fetch', fetcher);
    await markNotificationsRead('notice-id');
    expect(fetcher).toHaveBeenCalledWith('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'notice-id' }),
    });
  });
  it('surfaces failures for read and mutation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    await expect(fetchNotifications()).rejects.toThrow();
    await expect(markNotificationsRead()).rejects.toThrow();
  });
});
