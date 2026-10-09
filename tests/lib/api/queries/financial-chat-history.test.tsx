import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useChatHistory, useDeleteChat } from '@/lib/api/queries/financial-chat-history.queries';
describe('chat history hooks', () => {
  afterEach(() => vi.unstubAllGlobals());
  function setup() {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return { client, wrapper };
  }
  it('loads the selected page without HTTP caching', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: [], hasMore: false }));
    vi.stubGlobal('fetch', fetchMock);
    const { wrapper } = setup();
    const { result, unmount } = renderHook(() => useChatHistory(2), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith('/api/financial-chat/history?page=2', {
      cache: 'no-store',
    });
    unmount();
  });
  it('invalidates history after permanent deletion', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ deleted: true }));
    vi.stubGlobal('fetch', fetchMock);
    const { wrapper, client } = setup();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result, unmount } = renderHook(() => useDeleteChat(), { wrapper });
    await result.current.mutateAsync('entry-id');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/financial-chat/history',
      expect.objectContaining({ method: 'DELETE', body: '{"id":"entry-id"}' }),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['financial-chat-history'] });
    unmount();
  });
  it('does not invalidate saved answers when deletion fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({}, { status: 503 })));
    const { wrapper, client } = setup();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result, unmount } = renderHook(() => useDeleteChat(), { wrapper });
    await expect(result.current.mutateAsync('entry-id')).rejects.toThrow();
    expect(invalidate).not.toHaveBeenCalled();
    unmount();
  });
});
