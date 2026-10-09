import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchShortcutInbox } from '@/lib/api/queries/shortcut-inbox.queries';
afterEach(() => vi.unstubAllGlobals());
describe('inbox search query', () => {
  it('sends source, literal search and page with cancellation', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ data: [], count: 0 }));
    vi.stubGlobal('fetch', fetcher);
    const signal = new AbortController().signal;
    await fetchShortcutInbox(
      { page: 3, status: 'pending', source: 'forwarded_email', search: 'ARA & compras' },
      signal,
    );
    const url = new URL(fetcher.mock.calls[0][0] as string, 'https://example.test');
    expect(url.searchParams.get('q')).toBe('ARA & compras');
    expect(url.searchParams.get('source')).toBe('forwarded_email');
    expect(url.searchParams.get('page')).toBe('3');
    expect(fetcher.mock.calls[0][1]).toEqual({ cache: 'no-store', signal });
  });
  it('propagates failed owner reads instead of showing an empty inbox', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    await expect(fetchShortcutInbox({ page: 1, status: 'pending', search: '' })).rejects.toThrow(
      'Could not load inbox',
    );
  });
});
