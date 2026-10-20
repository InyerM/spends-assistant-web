import { createElement, type PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ owner: undefined as string | undefined }));
vi.mock('@/store/auth-store', () => ({ useAuthStore: () => state.owner }));
import { useExpenseCategoryQueue } from '@/lib/api/queries/expense-category-review.queries';
afterEach(() => {
  vi.unstubAllGlobals();
  state.owner = undefined;
});
it('does not fetch before authentication and isolates the queue cache when owners change', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const fetch = vi.fn(async () =>
    Response.json({ data: [{ id: state.owner }], count: 1, page: 1 }),
  );
  vi.stubGlobal('fetch', fetch);
  const wrapper = ({ children }: PropsWithChildren) =>
    createElement(QueryClientProvider, { client }, children);
  const { result, rerender } = renderHook(
    () => useExpenseCategoryQueue({ scope: 'uncategorized', search: '', page: 1 }),
    { wrapper },
  );
  expect(fetch).not.toHaveBeenCalled();
  act(() => {
    state.owner = 'first';
    rerender();
  });
  await waitFor(() => expect(result.current.data?.data[0].id).toBe('first'));
  act(() => {
    state.owner = 'second';
    rerender();
  });
  expect(result.current.data).toBeUndefined();
  await waitFor(() => expect(result.current.data?.data[0].id).toBe('second'));
  expect(fetch).toHaveBeenCalledTimes(2);
  client.clear();
});
