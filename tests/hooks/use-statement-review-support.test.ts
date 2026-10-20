import { createElement, type PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { useFxReference } from '@/lib/api/queries/fx-reference.queries';
import { useDocumentReviewStatus } from '@/lib/api/mutations/document-review-status.mutations';
afterEach(() => vi.unstubAllGlobals());
it('does not request an undated quote or save a workflow label until explicitly requested', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: PropsWithChildren) =>
    createElement(QueryClientProvider, { client }, children);
  const fetch = vi
    .fn()
    .mockResolvedValue(Response.json({ rate: 4000, date: '2026-09-01', approximate: true }));
  vi.stubGlobal('fetch', fetch);
  const { result } = renderHook(
    () => ({ quote: useFxReference(''), save: useDocumentReviewStatus('doc') }),
    { wrapper },
  );
  expect(fetch).not.toHaveBeenCalled();
  client.setQueryData(['documents', 'pending-count'], 1);
  await act(async () => {
    await result.current.save.mutateAsync('completed');
  });
  expect(fetch).toHaveBeenCalledWith(
    '/api/documents/doc/review-status',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ status: 'completed' }) }),
  );
  expect(client.getQueryState(['documents', 'pending-count'])?.isInvalidated).toBe(true);
  client.clear();
});
it('fetches the reference only for the supplied date', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) =>
    createElement(QueryClientProvider, { client }, children);
  const fetch = vi
    .fn()
    .mockResolvedValue(Response.json({ rate: 4000, date: '2026-09-01', approximate: true }));
  vi.stubGlobal('fetch', fetch);
  const { result } = renderHook(() => useFxReference('2026-09-01'), { wrapper });
  await waitFor(() => expect(result.current.data?.approximate).toBe(true));
  expect(fetch).toHaveBeenCalledWith('/api/fx-reference?date=2026-09-01');
  client.clear();
});
